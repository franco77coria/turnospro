export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyCancelToken, markCancelTokenUsed } from '@/lib/cancel-token'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/send-email'
import { notifyWaitlist } from '@/lib/waitlist'
import { applyRateLimit } from '@/lib/rate-limit'
import { CancelTokenSchema, parseBody } from '@/lib/schemas'
import { formatDateEs } from '@/lib/scheduling'
import { z } from 'zod'

const SessionCancelSchema = z.object({
    appointment_id: z.string().uuid(),
})

async function sendCancellationPush(supabase, appointment) {
    try {
        const { sendPushNotification } = await import('@/lib/push')
        const formattedDate = appointment.date.split('-').reverse().join('/')
        const formattedTime = appointment.time?.slice(0, 5)
        const clientName = appointment.clients?.name || 'Un cliente'
        const bizName = appointment.businesses?.name || 'el negocio'

        if (appointment.clients?.email) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', appointment.clients.email)
                .single()

            if (profile?.id) {
                await sendPushNotification(profile.id, {
                    title: 'Turno Cancelado ❌',
                    body: `Tu turno para ${appointment.service_name} en ${bizName} el ${formattedDate} a las ${formattedTime} hs fue cancelado.`,
                    url: '/book/my-appointments',
                    tag: `cancel-${appointment.id}`
                })
            }
        }

        const recipients = new Set()
        if (appointment.businesses?.owner_id) {
            recipients.add(appointment.businesses.owner_id)
        }

        if (appointment.team_member_id) {
            const { data: member } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('id', appointment.team_member_id)
                .single()
            if (member?.user_id) {
                recipients.add(member.user_id)
            }
        }

        const promises = Array.from(recipients).map(userId =>
            sendPushNotification(userId, {
                title: 'Turno Cancelado por Cliente ❌',
                body: `${clientName} canceló su turno para ${appointment.service_name} el ${formattedDate} a las ${formattedTime} hs.`,
                url: '/dashboard/calendar',
                tag: `cancel-biz-${appointment.id}`
            })
        )
        await Promise.all(promises)
    } catch (e) {
        console.error('Error sending cancellation push:', e)
    }
}

export async function POST(request) {
    try {
        // Rate limit cancel attempts: 20/min/IP. HMAC token already makes guessing
        // infeasible; this just prevents enumeration noise.
        const rateLimited = await applyRateLimit(request, { prefix: 'cancel', limit: 20, windowMs: 60000 })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const supabase = createSupabaseAdmin()

        // Dos caminos de entrada:
        //  - token HMAC del link del mail (invitados)
        //  - sesión iniciada, desde "Mis turnos"
        // Antes el segundo hacía un UPDATE directo desde el navegador y se
        // salteaba la antelación mínima, el aviso al negocio y la lista de espera.
        let token = null
        let appointmentId = null
        let expiresAt = null

        const sessionParsed = SessionCancelSchema.safeParse(raw)
        if (sessionParsed.success) {
            const cookieStore = await cookies()
            const authClient = createSupabaseServerClient(cookieStore)
            const { data: { user } } = await authClient.auth.getUser()
            if (!user?.email) {
                return NextResponse.json({ error: 'Iniciá sesión para cancelar' }, { status: 401 })
            }

            const { data: apt } = await supabase
                .from('appointments')
                .select('id, client_id, business_id, clients:client_id (email), businesses:business_id (owner_id)')
                .eq('id', sessionParsed.data.appointment_id)
                .maybeSingle()

            if (!apt) {
                return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
            }

            const isClient = apt.clients?.email
                && apt.clients.email.toLowerCase() === user.email.toLowerCase()
            const isOwner = apt.businesses?.owner_id === user.id
            if (!isClient && !isOwner) {
                return NextResponse.json({ error: 'No tenés permisos para cancelar este turno' }, { status: 403 })
            }

            appointmentId = apt.id
        } else {
            const parsed = parseBody(CancelTokenSchema, raw)
            if (!parsed.ok) {
                return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
            }
            token = parsed.data.token

            const verified = await verifyCancelToken(token)
            if (!verified.valid || !verified.appointmentId) {
                return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
            }
            appointmentId = verified.appointmentId
            expiresAt = verified.expiresAt
        }

        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*, businesses:business_id (name, slug, business_type, phone, settings, owner_id), clients:client_id (name, email)')
            .eq('id', appointmentId)
            .single()

        if (fetchErr || !appointment) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
        }

        if (appointment.status === 'cancelled') {
            return NextResponse.json({ error: 'Este turno ya fue cancelado' }, { status: 400 })
        }

        if (appointment.status === 'completed') {
            return NextResponse.json({ error: 'No se puede cancelar un turno completado' }, { status: 400 })
        }

        const minCancelHours = appointment.businesses?.settings?.min_cancel_hours ?? 2
        const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}:00`)
        const now = new Date()
        const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60)

        if (hoursUntil < minCancelHours) {
            return NextResponse.json({
                error: `No se puede cancelar con menos de ${minCancelHours} horas de anticipación. Contactá al negocio directamente.`,
            }, { status: 400 })
        }

        // Atomically claim the token. The unique constraint on token_hash
        // guarantees that only one caller wins the race; any concurrent
        // duplicate POST gets "already used". Solo aplica al link del mail:
        // la vía autenticada no consume ningún token de un solo uso.
        if (token) {
            const claim = await markCancelTokenUsed(supabase, token, appointmentId, expiresAt)
            if (!claim.ok) {
                const message = claim.reason === 'already_used'
                    ? 'Este link de cancelación ya fue utilizado.'
                    : 'No se pudo procesar la cancelación. Intentá de nuevo.'
                return NextResponse.json({ error: message }, { status: 409 })
            }
        }

        // El filtro por estado evita que dos pedidos simultáneos disparen dos
        // veces los mails y el aviso a la lista de espera.
        const { data: cancelledRows, error: updateErr } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', appointmentId)
            .not('status', 'in', '("cancelled","completed")')
            .select('id')

        if (updateErr) throw updateErr
        if (!cancelledRows?.length) {
            return NextResponse.json({ error: 'Este turno ya fue cancelado' }, { status: 409 })
        }

        if (appointment.client_id) {
            try {
                const currentMonth = new Date().toISOString().slice(0, 7)
                const { data: clientData } = await supabase
                    .from('clients')
                    .select('monthly_cancellations, last_cancellation_month')
                    .eq('id', appointment.client_id)
                    .single()

                if (clientData) {
                    const count = clientData.last_cancellation_month === currentMonth
                        ? (clientData.monthly_cancellations || 0) + 1
                        : 1

                    await supabase
                        .from('clients')
                        .update({ monthly_cancellations: count, last_cancellation_month: currentMonth })
                        .eq('id', appointment.client_id)
                }
            } catch (e) {
                console.error('Cancellation tracking error (non-critical):', e)
            }
        }

        const formattedDate = formatDateEs(appointment.date)
        const formattedTime = appointment.time?.slice(0, 5)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

        if (appointment.clients?.email) {
            try {
                await sendEmail({
                    type: 'cancellation',
                    to: appointment.clients.email,
                    data: {
                        clientName: appointment.clients.name || 'Cliente',
                        serviceName: appointment.service_name,
                        date: formattedDate,
                        time: formattedTime,
                        businessName: appointment.businesses?.name || 'GLOWUP',
                        businessType: appointment.businesses?.business_type || 'custom',
                        businessPhone: appointment.businesses?.phone,
                        bookUrl: `${appUrl}/book/${appointment.business_id}`,
                    }
                })
            } catch (e) {
                console.error('Cancel email to client failed:', e)
            }
        }

        const ownerId = appointment.businesses?.owner_id
        if (ownerId) {
            const { data: ownerProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', ownerId)
                .single()

            if (ownerProfile?.email) {
                try {
                    await sendEmail({
                        type: 'cancellation_notify',
                        to: ownerProfile.email,
                        data: {
                            clientName: appointment.clients?.name || 'Cliente',
                            clientEmail: appointment.clients?.email,
                            serviceName: appointment.service_name,
                            date: formattedDate,
                            time: formattedTime,
                            businessName: appointment.businesses?.name || 'GLOWUP',
                            businessType: appointment.businesses?.business_type || 'custom',
                            dashboardUrl: `${appUrl}/dashboard/appointments`,
                        }
                    })
                } catch (e) {
                    console.error('Cancel notify email to business failed:', e)
                }
            }

            await supabase.from('notifications').insert([{
                user_id: ownerId,
                business_id: appointment.business_id,
                type: 'appointment_cancelled',
                title: 'Turno cancelado',
                message: `${appointment.clients?.name || 'Un cliente'} canceló ${appointment.service_name} del ${formattedDate} a las ${formattedTime}.`,
            }]).catch(() => {})

            sendCancellationPush(supabase, appointment)
        }

        try {
            await notifyWaitlist(supabase, {
                businessId: appointment.business_id,
                date: appointment.date,
                teamMemberId: appointment.team_member_id,
                serviceName: appointment.service_name,
                businessName: appointment.businesses?.name,
                businessSlug: appointment.businesses?.slug,
                phoneNumberId: appointment.businesses?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID,
            })
        } catch (e) {
            console.error('Waitlist notify error (non-critical):', e)
        }

        return NextResponse.json({
            success: true,
            message: 'Turno cancelado exitosamente',
            appointment: {
                service_name: appointment.service_name,
                date: appointment.date,
                time: appointment.time,
                business_name: appointment.businesses?.name,
            },
        })
    } catch (err) {
        console.error('Cancel appointment error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
