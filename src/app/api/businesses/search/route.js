import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { resolveOpenStatus } from '@/lib/business-profile'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        // Trim and cap q + type to defend against memory exhaustion / weird inputs.
        // Strip Postgres ILIKE wildcards so users can't smuggle them into the pattern.
        const q = (searchParams.get('q') || '').slice(0, 100).replace(/[%_]/g, '')
        const type = (searchParams.get('type') || '').slice(0, 40)
        const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)

        // Public marketplace search — use anon key so RLS policies are enforced.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        let query = supabase
            .from('businesses')
            // cover_image_url faltaba: la tarjeta lo consultaba y nunca llegaba,
            // así que un negocio con portada cargada igual mostraba el degradado.
            .select('id, name, business_type, address, slug, settings, cover_image_url, avg_rating, total_reviews')
            .limit(limit)

        if (q.trim()) {
            query = query.ilike('name', `%${q.trim()}%`)
        }

        if (type.trim()) {
            query = query.eq('business_type', type.trim())
        }

        const { data, error } = await query
        if (error) throw error

        const rows = data || []
        const ids = rows.map(b => b.id)

        // Servicios desde la tabla, no desde el JSONB `businesses.services`.
        // Ese JSONB quedó congelado con las plantillas del onboarding: Barone
        // figuraba con 6 servicios cuando en el catálogo real tiene 2.
        const countByBusiness = new Map()
        const priceByBusiness = new Map()
        if (ids.length > 0) {
            const { data: services } = await supabase
                .from('services')
                .select('business_id, price')
                .in('business_id', ids)
                .eq('active', true)

            for (const svc of services || []) {
                countByBusiness.set(svc.business_id, (countByBusiness.get(svc.business_id) || 0) + 1)
                if (svc.price == null) continue
                const current = priceByBusiness.get(svc.business_id)
                if (current == null || svc.price < current) {
                    priceByBusiness.set(svc.business_id, svc.price)
                }
            }
        }

        const businesses = rows.map(biz => ({
            id: biz.id,
            name: (biz.name || '').trim(),
            business_type: biz.business_type,
            address: biz.address || '',
            slug: biz.slug,
            cover_image_url: biz.cover_image_url || null,
            services_count: countByBusiness.get(biz.id) || 0,
            price_from: priceByBusiness.get(biz.id) ?? null,
            // avg_rating y total_reviews los mantiene un trigger: no hace falta
            // traer todas las reseñas y promediarlas en JS como antes.
            avg_rating: Number(biz.avg_rating) || 0,
            review_count: biz.total_reviews || 0,
            open_status: resolveOpenStatus(biz.settings),
        }))

        // Sin búsqueda por texto, primero los mejor puntuados; a igual puntaje,
        // los que tienen catálogo cargado, que son los que se pueden reservar.
        if (!q.trim()) {
            businesses.sort((a, b) =>
                b.avg_rating - a.avg_rating || b.services_count - a.services_count
            )
        }

        return NextResponse.json({ businesses })
    } catch (err) {
        console.error('Business search error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
