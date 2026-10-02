import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveOpenStatus } from '@/lib/business-profile'
import { planVigente } from '@/lib/plan'
import { distanceKm } from '@/lib/concierge'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        // Trim and cap q + type to defend against memory exhaustion / weird inputs.
        // Strip Postgres ILIKE wildcards so users can't smuggle them into the pattern.
        const q = (searchParams.get('q') || '').slice(0, 100).replace(/[%_]/g, '')
        const type = (searchParams.get('type') || '').slice(0, 40)
        const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)
        const latValue = Number(searchParams.get('lat'))
        const lngValue = Number(searchParams.get('lng'))
        const hasLocation = searchParams.has('lat') && searchParams.has('lng') &&
            Number.isFinite(latValue) && latValue >= -90 && latValue <= 90 &&
            Number.isFinite(lngValue) && lngValue >= -180 && lngValue <= 180

        // Public marketplace search — use anon key so RLS policies are enforced.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        let query = supabase
            .from('businesses')
            // cover_image_url faltaba: la tarjeta lo consultaba y nunca llegaba,
            // así que un negocio con portada cargada igual mostraba el degradado.
            .select('id, name, business_type, address, latitude, longitude, slug, settings, cover_image_url, avg_rating, total_reviews, plan_status, plan_expires_at')
            .not('slug', 'is', null)
            .limit(Math.max(limit * 3, 50))

        if (type.trim()) {
            query = query.eq('business_type', type.trim())
        }

        const { data, error } = await query
        if (error) throw error

        const rows = (data || []).filter(planVigente)
        const ids = rows.map(b => b.id)

        // Servicios desde la tabla, no desde el JSONB `businesses.services`.
        // Ese JSONB quedó congelado con las plantillas del onboarding: Barone
        // figuraba con 6 servicios cuando en el catálogo real tiene 2.
        const countByBusiness = new Map()
        const priceByBusiness = new Map()
        const servicesByBusiness = new Map()
        if (ids.length > 0) {
            const { data: services } = await supabase
                .from('services')
                .select('business_id, name, price')
                .in('business_id', ids)
                .eq('active', true)

            for (const svc of services || []) {
                countByBusiness.set(svc.business_id, (countByBusiness.get(svc.business_id) || 0) + 1)
                const list = servicesByBusiness.get(svc.business_id) || []
                list.push(svc.name)
                servicesByBusiness.set(svc.business_id, list)
                if (svc.price == null) continue
                const current = priceByBusiness.get(svc.business_id)
                if (current == null || svc.price < current) {
                    priceByBusiness.set(svc.business_id, svc.price)
                }
            }
        }

        const needle = q.trim().toLocaleLowerCase('es-AR')
        const businesses = rows.map(biz => {
            const serviceNames = servicesByBusiness.get(biz.id) || []
            const matchingServices = needle
                ? serviceNames.filter(name => name?.toLocaleLowerCase('es-AR').includes(needle)).slice(0, 3)
                : []
            const nameMatch = !needle || biz.name?.toLocaleLowerCase('es-AR').includes(needle)
            if (!nameMatch && matchingServices.length === 0) return null
            return {
                id: biz.id,
                name: (biz.name || '').trim(),
                business_type: biz.business_type,
                address: biz.address || '',
                latitude: biz.latitude == null ? null : Number(biz.latitude),
                longitude: biz.longitude == null ? null : Number(biz.longitude),
                slug: biz.slug,
                cover_image_url: biz.cover_image_url || null,
                services_count: countByBusiness.get(biz.id) || 0,
                price_from: priceByBusiness.get(biz.id) ?? null,
                matching_services: matchingServices,
                distance_km: hasLocation && biz.latitude != null && biz.longitude != null
                    ? distanceKm(latValue, lngValue, Number(biz.latitude), Number(biz.longitude))
                    : null,
                name_match: Boolean(needle && nameMatch),
                // avg_rating y total_reviews los mantiene un trigger: no hace falta
                // traer todas las reseñas y promediarlas en JS como antes.
                avg_rating: Number(biz.avg_rating) || 0,
                review_count: biz.total_reviews || 0,
                open_status: resolveOpenStatus(biz.settings),
            }
        }).filter(Boolean)

        businesses.sort((a, b) => {
            if (hasLocation) {
                if (a.distance_km == null && b.distance_km != null) return 1
                if (a.distance_km != null && b.distance_km == null) return -1
                if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
                    return a.distance_km - b.distance_km
                }
            }
            if (needle && a.name_match !== b.name_match) return a.name_match ? -1 : 1
            return b.avg_rating - a.avg_rating || b.services_count - a.services_count
        })

        return NextResponse.json({ businesses: businesses.slice(0, limit) })
    } catch (err) {
        console.error('Business search error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
