import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'

export async function POST(request) {
    try {
        // Rate limit: 5 bookings/minute per IP
        const rateLimited = applyRateLimit(request, { prefix: 'booking', limit: 5, windowMs: 60000 })
        if (rateLimited) return rateLimited

        const body = await request.json()
        const { business_id, client_id, team_member_id, service_name, date, time, duration, price, notes } = body

        if (!business_id || !date || !time || !service_name) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Try using the atomic RPC function for race-condition safety
        try {
            const { data: appointmentId, error: rpcError } = await supabase.rpc('book_appointment', {
                p_business_id: business_id,
                p_client_id: client_id || null,
                p_team_member_id: team_member_id || null,
                p_service_name: service_name,
                p_date: date,
                p_time: time,
                p_duration: duration || 30,
                p_price: price || 0,
                p_notes: notes || null,
            })

            if (rpcError) {
                if (rpcError.message?.includes('SLOT_CONFLICT')) {
                    return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro.' }, { status: 409 })
                }
                throw rpcError
            }

            return NextResponse.json({ success: true, appointmentId })
        } catch (rpcErr) {
            // Fallback: if RPC doesn't exist yet, use direct insert (unique index will prevent duplicates)
            if (rpcErr.message?.includes('function') && rpcErr.message?.includes('does not exist')) {
                const { data: created, error: insertErr } = await supabase
                    .from('appointments')
                    .insert([{
                        business_id,
                        client_id: client_id || null,
                        team_member_id: team_member_id || null,
                        service_name,
                        date,
                        time,
                        duration: duration || 30,
                        price: price || 0,
                        notes: notes || null,
                        status: 'pending',
                    }])
                    .select('id')
                    .single()

                if (insertErr) {
                    // Unique index violation = double booking attempt
                    if (insertErr.code === '23505') {
                        return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro.' }, { status: 409 })
                    }
                    throw insertErr
                }

                return NextResponse.json({ success: true, appointmentId: created.id })
            }
            throw rpcErr
        }
    } catch (err) {
        console.error('Booking API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
