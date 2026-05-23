import { NextResponse } from 'next/server'
import { isBusinessClosed, isTeamMemberAbsent } from '@/lib/availability'
import { applyRateLimit } from '@/lib/rate-limit'
import { AvailabilityCheckSchema, parseBody } from '@/lib/schemas'

export async function POST(request) {
    try {
        // Rate limit per IP — availability checks are public but cheap to abuse for enumeration
        const rateLimited = applyRateLimit(request, { prefix: 'check', limit: 60, windowMs: 60000 })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(AvailabilityCheckSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { business_id, date, time, duration, team_member_id, buffer_time } = parsed.data

        // Use anon-level query — this is a public availability check, no RLS bypass needed
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        const closed = await isBusinessClosed(supabase, business_id, date)
        if (closed) {
            return NextResponse.json({ available: false, reason: 'El negocio está cerrado en esta fecha' })
        }

        if (team_member_id) {
            const absent = await isTeamMemberAbsent(supabase, team_member_id, business_id, date)
            if (absent) {
                return NextResponse.json({ available: false, reason: 'El profesional no está disponible en esta fecha' })
            }
        }

        const bufferMinutes = buffer_time || 0

        const [h, m] = time.split(':').map(Number)
        const slotStart = h * 60 + m
        const slotEnd = slotStart + (duration || 30)

        let query = supabase
            .from('appointments')
            .select('time, duration, team_member_id')
            .eq('business_id', business_id)
            .eq('date', date)
            .not('status', 'in', '("cancelled","no_show")')

        if (team_member_id) {
            query = query.eq('team_member_id', team_member_id)
        }

        const { data: appointments, error } = await query
        if (error) throw error

        const conflict = (appointments || []).find(apt => {
            const [ah, am] = apt.time.split(':').map(Number)
            const aptStart = ah * 60 + am
            const aptEnd = aptStart + (apt.duration || 30) + bufferMinutes
            return slotStart < aptEnd && (slotEnd + bufferMinutes) > aptStart
        })

        return NextResponse.json({
            available: !conflict,
            conflict: conflict ? { time: conflict.time, duration: conflict.duration } : null,
        })
    } catch (err) {
        console.error('Availability check error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
