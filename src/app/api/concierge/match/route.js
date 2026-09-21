import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { applyRateLimit } from '@/lib/rate-limit'
import { distanceKm, rankMatches } from '@/lib/concierge'
import { planVigente } from '@/lib/plan'
import { formatDateLocal, generateAvailableSlots, isWorkDay, toOccupiedRanges } from '@/lib/scheduling'
import { nowInTimezone } from '@/lib/timezone'
import { normalizeService } from '@/lib/services'

export const dynamic = 'force-dynamic'

const categories = ['barberia', 'peluqueria', 'unas', 'lash', 'spa', 'consultorio', 'veterinaria', 'custom']
const Search = z.object({
    category: z.enum(categories),
    when: z.enum(['today', 'afternoon', 'tomorrow']),
    service: z.string().trim().max(100).optional(),
    zone: z.string().trim().max(80).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
})

function db() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

async function catalog(client, businesses) {
    const ids = businesses.map(b => b.id)
    if (!ids.length) return new Map()
    const { data, error } = await client.from('services')
        .select('id, business_id, name, duration, price, active')
        .in('business_id', ids).eq('active', true)
    if (error) throw error
    const byBusiness = new Map()
    for (const biz of businesses) byBusiness.set(biz.id, [])
    for (const raw of data || []) byBusiness.get(raw.business_id)?.push(normalizeService(raw))
    for (const biz of businesses) {
        if (!byBusiness.get(biz.id).length) {
            byBusiness.set(biz.id, (Array.isArray(biz.services) ? biz.services : [])
                .map(normalizeService).filter(s => s?.active))
        }
    }
    return byBusiness
}

async function eligibleBusinesses(client, category) {
    const { data, error } = await client.from('businesses')
        .select('id, name, slug, address, business_type, settings, timezone, latitude, longitude, cover_image_url, services, plan_status, plan_expires_at')
        .eq('business_type', category).not('slug', 'is', null).limit(40)
    if (error) throw error
    return (data || []).filter(planVigente)
}

async function fetchBusy(client, ids, dates) {
    const rows = []
    for (let offset = 0; offset < 5000; offset += 1000) {
        const { data, error } = await client.from('public_busy_slots')
            .select('business_id, date, time, duration, team_member_id')
            .in('business_id', ids).in('date', dates)
            .range(offset, offset + 999)
        if (error) throw error
        rows.push(...(data || []))
        if ((data || []).length < 1000) return rows
    }
    throw new Error('Demasiados turnos para verificar la agenda')
}

export async function GET(request) {
    const category = new URL(request.url).searchParams.get('category')
    if (!categories.includes(category)) return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    const limited = await applyRateLimit(request, { prefix: 'concierge:services', limit: 30, windowMs: 60_000 })
    if (limited) return limited
    try {
        const client = db()
        const businesses = await eligibleBusinesses(client, category)
        const services = await catalog(client, businesses)
        return NextResponse.json({ services: [...new Set([...services.values()].flat().map(s => s.name))].slice(0, 35) })
    } catch (error) {
        console.error('Concierge catalog:', error)
        return NextResponse.json({ error: 'No se pudo consultar el catálogo' }, { status: 503 })
    }
}

export async function POST(request) {
    const limited = await applyRateLimit(request, { prefix: 'concierge:match', limit: 12, windowMs: 60_000 })
    if (limited) return limited
    const parsed = Search.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Búsqueda inválida' }, { status: 400 })
    const { category, when, service, zone, lat, lng } = parsed.data
    try {
        const client = db()
        const businesses = await eligibleBusinesses(client, category)
        const services = await catalog(client, businesses)
        const ids = businesses.map(b => b.id)
        if (!ids.length) return NextResponse.json({ matches: [] })

        // Fetch occupancy and exceptions together. Any failed source fails the
        // request closed; empty rows after a permission error mean false slots.
        const dates = [...new Set(businesses.flatMap(b => {
            const now = nowInTimezone(b.timezone || undefined)
            const tomorrow = new Date(now)
            tomorrow.setDate(now.getDate() + 1)
            return [formatDateLocal(now), formatDateLocal(tomorrow)]
        }))].sort()
        const [busy, closures, absences, roster] = await Promise.all([
            fetchBusy(client, ids, dates),
            client.from('business_closures').select('business_id, date').in('business_id', ids).in('date', dates),
            client.from('team_absences').select('business_id, team_member_id, start_date, end_date').in('business_id', ids).lte('start_date', dates.at(-1)).gte('end_date', dates[0]),
            client.from('team_members').select('id, business_id').in('business_id', ids).eq('active', true),
        ])
        for (const result of [closures, absences, roster]) if (result.error) throw result.error

        const matches = []
        for (const biz of businesses) {
            const now = nowInTimezone(biz.timezone || undefined)
            const bizServices = (services.get(biz.id) || []).filter(s => !service || s.name.toLocaleLowerCase('es-AR') === service.toLocaleLowerCase('es-AR'))
            const team = (roster.data || []).filter(m => m.business_id === biz.id)
            let best = null
            for (const dayOffset of when === 'tomorrow' ? [1] : [0, 1]) {
                const d = new Date(now)
                d.setDate(d.getDate() + dayOffset)
                const date = formatDateLocal(d)
                if (!isWorkDay(biz.settings, date) || (closures.data || []).some(c => c.business_id === biz.id && c.date === date) ||
                    biz.settings?.closed_dates?.some(c => c.date === date)) continue
                const absent = new Set((absences.data || []).filter(a => a.business_id === biz.id && a.start_date <= date && a.end_date >= date).map(a => a.team_member_id))
                const availableTeam = team.filter(m => !absent.has(m.id))
                if (team.length && !availableTeam.length) continue
                const occupied = toOccupiedRanges(busy.filter(a => a.business_id === biz.id && a.date === date))
                for (const svc of bizServices) {
                    const times = generateAvailableSlots({ settings: biz.settings, duration: svc.duration,
                        occupied, date, now, capacity: team.length ? availableTeam.length : 1 })
                        .filter(time => when !== 'afternoon' || dayOffset || time >= '12:00')
                    if (!times.length) continue
                    const proposal = { dayOffset, date, time: times[0], service: svc }
                    if (!best || proposal.dayOffset < best.dayOffset ||
                        (proposal.dayOffset === best.dayOffset && proposal.time < best.time)) best = proposal
                }
                if (best) break
            }
            if (!best) continue
            matches.push({
                businessId: biz.id, name: biz.name, slug: biz.slug, address: biz.address || '',
                cover: biz.cover_image_url || null, date: best.date, time: best.time,
                dayOffset: best.dayOffset, service: best.service.name,
                href: `/book/${biz.id}${best.service.legacy ? '' : `?service=${encodeURIComponent(best.service.id)}`}`,
                distanceKm: lat != null && lng != null && biz.latitude != null && biz.longitude != null
                    ? distanceKm(lat, lng, Number(biz.latitude), Number(biz.longitude)) : null,
            })
        }
        return NextResponse.json({ matches: rankMatches(matches, zone).slice(0, 8), zoneHasMatches: !zone || matches.some(m => m.address.toLocaleLowerCase('es-AR').includes(zone.toLocaleLowerCase('es-AR'))) })
    } catch (error) {
        console.error('Concierge match:', error)
        return NextResponse.json({ error: 'No se pudo verificar la disponibilidad. Reintentá.' }, { status: 503 })
    }
}
