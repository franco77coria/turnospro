import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { confirmationEmail, reminderEmail, welcomeEmail, newBookingNotifyEmail, cancellationEmail, cancellationNotifyEmail } from '@/lib/email-templates'
import { generateCancelToken } from '@/lib/cancel-token'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
    try {
        const body = await request.json()
        const { type, to, data } = body

        if (!to || !type || !data) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        let html, subject

        switch (type) {
            case 'confirmation':
                // Generate cancel link if appointment ID is available
                if (data.appointmentId) {
                    const cancelToken = await generateCancelToken(data.appointmentId)
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
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

            default:
                return NextResponse.json({ error: 'Tipo de email no válido' }, { status: 400 })
        }

        // Use onboarding@resend.dev — the only allowed sender on Resend free tier
        // To use a custom sender, verify a domain at resend.com/domains
        const { data: emailData, error } = await resend.emails.send({
            from: `${data.businessName || 'GLOWUP'} <onboarding@resend.dev>`,
            to: [to],
            subject,
            html,
        })

        if (error) {
            console.error('Resend error:', JSON.stringify(error))
            return NextResponse.json({ error: error.message || 'Error enviando email' }, { status: 500 })
        }

        return NextResponse.json({ success: true, id: emailData?.id })
    } catch (err) {
        console.error('Email API error:', err)
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
