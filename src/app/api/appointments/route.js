import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'
import { BookingSchema, parseBody } from '@/lib/schemas'

// Helper para enviar confirmación de turno vía WhatsApp al cliente
async function sendAppointmentWhatsAppConfirmation(supabase, business_id, client_id, service_name, date, time) {
    if (!client_id) return
    try {
        const { data: client } = await supabase
            .from('clients')
            .select('name, phone')
            .eq('id', client_id)
            .single()

        if (!client?.phone) return

        const { data: business } = await supabase
            .from('businesses')
            .select('name, settings')
            .eq('id', business_id)
            .single()

        const bizName = business?.name || 'GLOWUP'
        const phoneNumberId = business?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID

        const formattedDate = date.split('-').reverse().join('/')

        const { sendWhatsAppText } = await import('@/lib/whatsapp')
        await sendWhatsAppText({
            to: client.phone,
            phoneNumberId,
            text: `¡Hola ${client.name || 'Cliente'}! Tu turno ha sido reservado con éxito 🎉\n\n📅 Servicio: ${service_name}\n🕒 Fecha: ${formattedDate} a las ${time} hs\n🏢 Local: ${bizName}\n\n¡Te esperamos!`
        })
    } catch (e) {
        console.error('Error in sendAppointmentWhatsAppConfirmation helper:', e)
    }
}

async function notifyPush(supabase, business_id, client_id, service_name, date, time) {
    if (!client_id) return
    try {
        const { data: client } = await supabase
            .from('clients')
            .select('email')
            .eq('id', client_id)
            .single()

        if (!client?.email) return

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
        // 1. Require authentication (closes spam/abuse vector).
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 2. Rate-limit per user — 10/min/user (more generous than per-IP since each user is identified)
        const rateLimited = applyRateLimit(request, {
            prefix: `booking:${user.id}`,
            limit: 10,
            windowMs: 60000,
        })
        if (rateLimited) return rateLimited

        // 3. Validate input with Zod
        const raw = await request.json().catch(() => null)
        const parsed = parseBody(BookingSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { business_id, client_id, team_member_id, service_name, date, time, duration, price, notes } = parsed.data

        const supabase = createSupabaseAdmin()

        // 4. If a client_id is provided, verify the caller is allowed to book for them.
        //    Either:
        //      - The client belongs to a business the user owns (staff booking flow), OR
        //      - The client's email matches the caller's email (self-booking flow).
        if (client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('id, business_id, email')
                .eq('id', client_id)
                .single()
            if (!client) {
                return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
            }
            const isSelf = client.email && user.email && client.email.toLowerCase() === user.email.toLowerCase()
            let isStaff = false
            if (!isSelf) {
                const { data: biz } = await supabase
                    .from('businesses')
                    .select('owner_id')
                    .eq('id', client.business_id)
                    .single()
                if (biz?.owner_id === user.id) {
                    isStaff = true
                } else {
                    const { data: member } = await supabase
                        .from('team_members')
                        .select('id')
                        .eq('business_id', client.business_id)
                        .eq('user_id', user.id)
                        .eq('active', true)
                        .maybeSingle()
                    isStaff = !!member
                }
            }
            if (!isSelf && !isStaff) {
                return NextResponse.json({ error: 'No tenés permisos para reservar para este cliente' }, { status: 403 })
            }
            // Ensure the client belongs to the same business as the booking
            if (client.business_id !== business_id) {
                return NextResponse.json({ error: 'El cliente no pertenece a este negocio' }, { status: 400 })
            }
        }

        // 5. Atomic booking RPC (race-condition safe) — with fallback to insert.
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

            notifyPush(supabase, business_id, client_id, service_name, date, time)
            notifyBusinessPush(supabase, business_id, team_member_id, service_name, date, time, client_id)
            sendAppointmentWhatsAppConfirmation(supabase, business_id, client_id, service_name, date, time)

            return NextResponse.json({ success: true, appointmentId })
        } catch (rpcErr) {
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
                    if (insertErr.code === '23505') {
                        return NextResponse.json({ error: 'El horario ya está ocupado. Elegí otro.' }, { status: 409 })
                    }
                    throw insertErr
                }

                notifyPush(supabase, business_id, client_id, service_name, date, time)
                notifyBusinessPush(supabase, business_id, team_member_id, service_name, date, time, client_id)
                sendAppointmentWhatsAppConfirmation(supabase, business_id, client_id, service_name, date, time)

                return NextResponse.json({ success: true, appointmentId: created.id })
            }
            throw rpcErr
        }
    } catch (err) {
        console.error('Booking API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
