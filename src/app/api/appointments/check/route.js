import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request) {
    try {
        const { business_id, date, time, duration, team_member_id, buffer_time } = await request.json()

        if (!business_id || !date || !time) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        // Use anon-level query — this is a public availability check, no RLS bypass needed
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        const bufferMinutes = buffer_time || 0

        // Parse time to minutes
        const [h, m] = time.split(':').map(Number)
        const slotStart = h * 60 + m
        const slotEnd = slotStart + (duration || 30)

        // Fetch active appointments for that date
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

        // Check for overlap (including buffer time between appointments)
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
