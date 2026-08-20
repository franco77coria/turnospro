// Helper to send emails from client/server components
// Supports both server-side (direct Resend) and client-side (via /api/email)

import { confirmationEmail, reminderEmail, welcomeEmail, newBookingNotifyEmail, cancellationEmail, cancellationNotifyEmail, reviewRequestEmail, waitlistSlotEmail } from '@/lib/email-templates'
import { generateCancelToken } from '@/lib/cancel-token'
import { formatDateEs } from '@/lib/scheduling'

/**
 * Send an email. Works from both server and client contexts.
 * Server-side: sends directly via Resend SDK (no fetch to self)
 * Client-side: calls /api/email endpoint
 */
export async function sendEmail({ type, to, data }) {
    try {
        // Detect if we're on the server
        const isServer = typeof window === 'undefined'

        if (isServer) {
            const apiKey = process.env.RESEND_API_KEY
            if (!apiKey) {
                console.error('[sendEmail Error]: RESEND_API_KEY no está configurada en las variables de entorno de Vercel!')
                return { error: 'RESEND_API_KEY no configurada en servidor' }
            }

            // Server-side: send directly via Resend
            const { Resend } = await import('resend')
            const resend = new Resend(apiKey)

            let html, subject
            switch (type) {
                case 'confirmation':
                    if (data.appointmentId) {
                        const cancelToken = await generateCancelToken(data.appointmentId)
                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'
                        data.cancelUrl = `${appUrl}/cancel/${cancelToken}`
                    }
                    html = confirmationEmail(data)
                    subject = `Turno confirmado — ${data.serviceName} | ${data.businessName}`
                    break
                case 'reminder':
                    html = reminderEmail(data)
                    subject = `Recordatorio de turno — ${data.hoursUntil <= 1 ? 'En menos de 1 hora' : `En ${data.hoursUntil} horas`} | ${data.businessName}`
                    break
                case 'welcome':
                    html = welcomeEmail(data)
                    subject = `Bienvenido/a a ${data.businessName}`
                    break
                case 'new_booking_notify':
                    html = newBookingNotifyEmail(data)
                    subject = `Nueva reserva — ${data.clientName} | ${data.serviceName}`
                    break
                case 'cancellation':
                    html = cancellationEmail(data)
                    subject = `Turno cancelado — ${data.serviceName} | ${data.businessName}`
                    break
                case 'cancellation_notify':
                    html = cancellationNotifyEmail(data)
                    subject = `Turno cancelado — ${data.clientName} canceló ${data.serviceName}`
                    break
                case 'review_request':
                    html = reviewRequestEmail(data)
                    subject = `¿Cómo fue tu experiencia? — ${data.businessName}`
                    break
                case 'waitlist_slot':
                    html = waitlistSlotEmail(data)
                    subject = `Se liberó un turno — ${data.date} | ${data.businessName}`
                    break
                default:
                    return { error: 'Tipo de email no válido' }
            }

            const { data: emailData, error } = await resend.emails.send({
                from: `${data.businessName || 'Tu GlowUp'} <notificaciones@tu-glowup.com>`,
                to: [to],
                subject,
                html,
            })

            if (error) {
                console.error('[Resend Error]:', error)
                throw new Error(error.message || 'Error enviando email')
            }
            console.log('[Resend Success]: Email enviado exitosamente a', to, 'ID:', emailData?.id)
            return { success: true, id: emailData?.id }
        }

        // Client-side: use fetch to API route
        const res = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, to, data }),
        })

        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Error al enviar email')
        return result
    } catch (err) {
        console.error('sendEmail error:', err)
        return { error: err.message }
    }
}

// Send confirmation email when appointment is created
export async function sendAppointmentConfirmation({ appointment, client, business, service, professional }) {
    if (!client?.email) return { error: 'Cliente sin email' }

    const formattedDate = formatDateEs(appointment.date, { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'confirmation',
        to: client.email,
        data: {
            clientName: client.name || 'Cliente',
            serviceName: service?.name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            duration: service?.duration || appointment.duration,
            professional: professional?.name || appointment.professional,
            businessName: business?.name || 'GLOWUP',
            businessType: business?.business_type || 'custom',
            businessPhone: business?.phone,
            appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/book/my-appointments`,
            appointmentId: appointment.id || appointment.appointmentId,
        }
    })
}

// Send reminder email
export async function sendAppointmentReminder({ appointment, client, business, service, hoursUntil }) {
    if (!client?.email) return { error: 'Cliente sin email' }

    const formattedDate = formatDateEs(appointment.date, { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'reminder',
        to: client.email,
        data: {
            clientName: client.name || 'Cliente',
            serviceName: service?.name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            hoursUntil: hoursUntil || 24,
            businessName: business?.name || 'GLOWUP',
            businessType: business?.business_type || 'custom',
            businessPhone: business?.phone,
            appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/my-appointments`,
        }
    })
}

// Notify business owner of new booking
export async function sendNewBookingNotify({ appointment, client, business }) {
    if (!business?.owner_email) return { error: 'Negocio sin email de dueño' }

    const formattedDate = formatDateEs(appointment.date, { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'new_booking_notify',
        to: business.owner_email,
        data: {
            clientName: client?.name || 'Cliente',
            clientEmail: client?.email,
            clientPhone: client?.phone,
            serviceName: appointment.service_name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            duration: appointment.duration,
            businessName: business?.name || 'GLOWUP',
            businessType: business?.business_type || 'custom',
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/appointments`,
        }
    })
}

// Send cancellation email to client
export async function sendCancellationEmail({ appointment, client, business }) {
    if (!client?.email) return { error: 'Cliente sin email' }

    const formattedDate = formatDateEs(appointment.date, { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'cancellation',
        to: client.email,
        data: {
            clientName: client.name || 'Cliente',
            serviceName: appointment.service_name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            businessName: business?.name || 'GLOWUP',
            businessType: business?.business_type || 'custom',
            businessPhone: business?.phone,
            bookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${business?.id}`,
        }
    })
}

// Notify business owner of cancellation
export async function sendCancellationNotify({ appointment, client, business }) {
    if (!business?.owner_email) return { error: 'Negocio sin email de dueño' }

    const formattedDate = formatDateEs(appointment.date, { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'cancellation_notify',
        to: business.owner_email,
        data: {
            clientName: client?.name || 'Cliente',
            clientEmail: client?.email,
            serviceName: appointment.service_name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            businessName: business?.name || 'GLOWUP',
            businessType: business?.business_type || 'custom',
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/appointments`,
        }
    })
}
