import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const { business_id, date, time, duration, team_member_id } = await request.json()

        if (!business_id || !date || !time) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

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

        // Check for overlap
        const conflict = (appointments || []).find(apt => {
            const [ah, am] = apt.time.split(':').map(Number)
            const aptStart = ah * 60 + am
            const aptEnd = aptStart + (apt.duration || 30)
            return slotStart < aptEnd && slotEnd > aptStart
        })

        return NextResponse.json({
            available: !conflict,
            conflict: conflict ? { time: conflict.time, duration: conflict.duration } : null,
        })
    } catch (err) {
        console.error('Availability check error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
