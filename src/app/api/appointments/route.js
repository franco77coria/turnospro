import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'

// Helper para enviar notificación push al cliente
async function notifyPush(supabase, business_id, client_id, service_name, date, time) {
    if (!client_id) return
    try {
        // Obtener email del cliente
        const { data: client } = await supabase
            .from('clients')
            .select('email')
            .eq('id', client_id)
            .single()

        if (!client?.email) return

        // Buscar perfil del usuario con ese email
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', client.email)
            .single()

        if (!profile?.id) return

        const { data: business } = await supabase
            .from('businesses')
            .select('name')
            .eq('id', business_id)
            .single()

        const { sendPushNotification } = await import('@/lib/push')
        const bizName = business?.name || 'el negocio'
        
        // Formatear fecha legible
        const formattedDate = date.split('-').reverse().join('/')

        await sendPushNotification(profile.id, {
            title: 'Turno Reservado con Éxito 🎉',
            body: `Tu turno para ${service_name} en ${bizName} fue agendado para el ${formattedDate} a las ${time} hs.`,
            url: '/book/my-appointments',
            tag: 'appointment-booking'
        })
    } catch (e) {
        console.error('Error in notifyPush helper:', e)
    }
}

// Helper para enviar notificación push al negocio (dueño y profesional)
async function notifyBusinessPush(supabase, business_id, team_member_id, service_name, date, time, client_id) {
    try {
        const { data: business } = await supabase
            .from('businesses')
            .select('owner_id, name')
            .eq('id', business_id)
            .single()

        if (!business) return

        let clientName = 'Un cliente'
        if (client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('name')
                .eq('id', client_id)
                .single()
            if (client?.name) {
                clientName = client.name
            }
        }

        const recipients = new Set()
        if (business.owner_id) {
            recipients.add(business.owner_id)
        }

        if (team_member_id) {
            const { data: member } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('id', team_member_id)
                .single()
            if (member?.user_id) {
                recipients.add(member.user_id)
            }
        }

        const { sendPushNotification } = await import('@/lib/push')
        const formattedDate = date.split('-').reverse().join('/')

        const promises = Array.from(recipients).map(userId => 
            sendPushNotification(userId, {
                title: 'Nuevo Turno Reservado 📅',
                body: `${clientName} reservó ${service_name} para el ${formattedDate} a las ${time} hs.`,
                url: '/dashboard/calendar',
                tag: 'appointment-new'
            })
        )
        await Promise.all(promises)
    } catch (e) {
        console.error('Error in notifyBusinessPush helper:', e)
    }
}

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

            // Notificar asincrónicamente
            notifyPush(supabase, business_id, client_id, service_name, date, time)
            notifyBusinessPush(supabase, business_id, team_member_id, service_name, date, time, client_id)

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

                // Notificar asincrónicamente
                notifyPush(supabase, business_id, client_id, service_name, date, time)
                notifyBusinessPush(supabase, business_id, team_member_id, service_name, date, time, client_id)

                return NextResponse.json({ success: true, appointmentId: created.id })
            }
            throw rpcErr
        }
    } catch (err) {
        console.error('Booking API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
