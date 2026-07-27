export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'
import { BookingSchema, parseBody } from '@/lib/schemas'
import { sendEmail } from '@/lib/send-email'

// Helper para enviar confirmación de turno vía WhatsApp al cliente (Desactivado temporalmente - Uso exclusivo de Email)
async function sendAppointmentWhatsAppConfirmation(supabase, business_id, client_id, service_name, date, time) {
    // Canal de WhatsApp desactivado por requerimiento (uso exclusivo de Email via Resend)
    return
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
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        // 1. Rate-limit (por ID si está autenticado, o por IP si es invitado)
        const rateLimitKey = user ? `booking:${user.id}` : 'booking:guest'
        const rateLimited = await applyRateLimit(request, {
            prefix: rateLimitKey,
            limit: 10,
            windowMs: 60000,
        })
        if (rateLimited) return rateLimited

        // 2. Validate input with Zod
        const raw = await request.json().catch(() => null)
        const parsed = parseBody(BookingSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        let { business_id, client_id, team_member_id, service_name, date, time, duration, price, notes, send_emails, coupon_id, guest_name, guest_email, guest_phone } = parsed.data

        const supabase = createSupabaseAdmin()

        // 3. Flujo de Invitado (Guest Booking): Si no hay cliente logueado, crear/vincular cliente por email o teléfono
        if (!client_id && (guest_email || guest_phone || guest_name)) {
            let existingClient = null
            if (guest_email) {
                const { data: foundByEmail } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('business_id', business_id)
                    .ilike('email', guest_email.trim())
                    .limit(1)
                    .maybeSingle()
                existingClient = foundByEmail
            }
            if (!existingClient && guest_phone) {
                const { data: foundByPhone } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('business_id', business_id)
                    .eq('phone', guest_phone.trim())
                    .limit(1)
                    .maybeSingle()
                existingClient = foundByPhone
            }

            if (existingClient) {
                client_id = existingClient.id
            } else {
                // Registrar nuevo cliente en la base del negocio
                const { data: newClient, error: createClientErr } = await supabase
                    .from('clients')
                    .insert([{
                        business_id,
                        name: guest_name || guest_email?.split('@')[0] || 'Cliente',
                        email: guest_email || null,
                        phone: guest_phone || null,
                    }])
                    .select('id')
                    .single()
                if (!createClientErr && newClient) {
                    client_id = newClient.id
                }
            }
        }

        // 4. Si se provee client_id y hay usuario autenticado, verificar permisos
        if (client_id && user) {
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
            const _emailDebug = await sendBookingSideEffects(supabase, {
                appointmentId, business_id, client_id, team_member_id,
                service_name, date, time, duration, send_emails, coupon_id,
                guest_name, guest_email, guest_phone, user_email: user?.email,
            })

            return NextResponse.json({ success: true, appointmentId, _emailDebug })
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
                const _emailDebug = await sendBookingSideEffects(supabase, {
                    appointmentId: created.id, business_id, client_id, team_member_id,
                    service_name, date, time, duration, send_emails, coupon_id,
                    guest_name, guest_email, guest_phone, user_email: user?.email,
                })

                return NextResponse.json({ success: true, appointmentId: created.id, _emailDebug })
            }
            throw rpcErr
        }
    } catch (err) {
        console.error('Booking API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function sendBookingSideEffects(supabase, {
    appointmentId, business_id, client_id, team_member_id,
    service_name, date, time, duration, send_emails, coupon_id,
    guest_name, guest_email, guest_phone, user_email,
}) {
    const debug = { steps: [] }
    const log = (msg) => { debug.steps.push(msg); console.log('[SideEffects]', msg) }

    log(`START appointmentId=${appointmentId} guest_email=${guest_email} user_email=${user_email} send_emails=${send_emails} client_id=${client_id}`)

    // Atomically consume coupon if provided
    if (coupon_id) {
        try { await supabase.rpc('increment_coupon_uses', { coupon_id }) } catch (e) { log(`Coupon failed: ${e.message}`) }
    }

    try {
        // 1. Get business info
        const { data: business, error: bizErr } = await supabase
            .from('businesses')
            .select('owner_id, name, business_type, phone')
            .eq('id', business_id)
            .maybeSingle()
        log(`Business: ${business ? business.name : 'NOT FOUND'} ${bizErr ? 'ERR:' + bizErr.message : ''}`)

        // 2. Resolve client info
        let clientName = guest_name || 'Un cliente'
        let clientEmail = guest_email || user_email || null
        let clientPhone = guest_phone || null

        if (client_id) {
            const { data: c } = await supabase.from('clients').select('name, email, phone').eq('id', client_id).maybeSingle()
            log(`Client lookup: ${JSON.stringify(c)}`)
            if (c?.name) clientName = c.name
            if (c?.email) clientEmail = c.email
            if (c?.phone) clientPhone = c.phone
        }

        // Triple fallback
        if (!clientEmail) clientEmail = user_email || guest_email || null
        log(`RESOLVED clientEmail=${clientEmail} clientName=${clientName}`)
        debug.clientEmail = clientEmail

        // 3. Parse date
        let dateObj = new Date()
        if (date && date.includes('-')) {
            const [y, m, d] = date.split('-').map(Number)
            dateObj = new Date(y, m - 1, d)
        }

        // 4. In-app notification
        if (business?.owner_id) {
            const formattedShort = dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
            await supabase.from('notifications').insert([{
                user_id: business.owner_id, business_id,
                type: 'appointment_booked', title: 'Nuevo turno reservado',
                message: `${clientName} reservó ${service_name} para el ${formattedShort} a las ${time}.`,
            }]).catch(() => {})
        }

        // 5. SEND EMAILS — directo con await, sin Promise chains
        if (send_emails === false) {
            log('send_emails is false — SKIP')
            debug.emailsSent = 0
            return debug
        }

        const formattedLong = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        debug.emailsSent = 0

        // 5a. Email al CLIENTE — await directo
        if (clientEmail) {
            log(`SENDING confirmation email to ${clientEmail}...`)
            try {
                const result = await sendEmail({
                    type: 'confirmation',
                    to: clientEmail,
                    data: {
                        clientName,
                        serviceName: service_name,
                        date: formattedLong,
                        time,
                        duration,
                        businessName: business?.name || 'Tu GlowUp',
                        businessType: business?.business_type || 'custom',
                        businessPhone: business?.phone,
                        appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/book/my-appointments`,
                        appointmentId,
                    }
                })
                log(`Client email result: ${JSON.stringify(result)}`)
                debug.clientEmailResult = result
                if (result?.success || result?.id) debug.emailsSent++
            } catch (e) {
                log(`Client email EXCEPTION: ${e.message}`)
                debug.clientEmailError = e.message
            }
        } else {
            log('NO clientEmail — SKIPPING confirmation')
        }

        // 5b. Email al DUEÑO — await directo
        if (business?.owner_id) {
            try {
                const { data: ownerProfile } = await supabase
                    .from('profiles').select('email').eq('id', business.owner_id).maybeSingle()
                log(`Owner profile: ${JSON.stringify(ownerProfile)}`)

                if (ownerProfile?.email) {
                    const ownerResult = await sendEmail({
                        type: 'new_booking_notify',
                        to: ownerProfile.email,
                        data: {
                            clientName, clientEmail, clientPhone,
                            serviceName: service_name, date: formattedLong, time, duration,
                            businessName: business?.name || 'Tu GlowUp',
                            businessType: business?.business_type || 'custom',
                            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/dashboard/appointments`,
                        }
                    })
                    log(`Owner email result: ${JSON.stringify(ownerResult)}`)
                    debug.ownerEmailResult = ownerResult
                    if (ownerResult?.success || ownerResult?.id) debug.emailsSent++
                }
            } catch (e) {
                log(`Owner email error: ${e.message}`)
            }
        }

        log(`END — emailsSent: ${debug.emailsSent}`)
        return debug
    } catch (e) {
        log(`OUTER ERROR: ${e.message}`)
        debug.error = e.message
        return debug
    }
}
