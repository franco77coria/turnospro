import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { confirmationEmail, reminderEmail, welcomeEmail, newBookingNotifyEmail, cancellationEmail, cancellationNotifyEmail, reviewRequestEmail } from '@/lib/email-templates'
import { generateCancelToken } from '@/lib/cancel-token'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'
import { EmailRequestSchema, parseBody } from '@/lib/schemas'

const resend = new Resend(process.env.RESEND_API_KEY)

// All email types require an authenticated session. Public booking flows
// send confirmations server-side via lib/send-email.js, not via this endpoint.
export async function POST(request) {
    try {
        // Authenticate first — closes the open phishing/spam vector that existed
        // when 'confirmation' was a public type.
        const cookieStore = await cookies()
        const supabase = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Rate limit per user (10/min) — bound to authenticated identity
        const rateLimited = await applyRateLimit(request, {
            prefix: `email:${user.id}`,
            limit: 10,
            windowMs: 60000,
        })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(EmailRequestSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { type, to, data } = parsed.data

        let html, subject

        switch (type) {
            case 'confirmation':
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

            case 'review_request':
                html = reviewRequestEmail(data)
                subject = `¿Cómo fue tu experiencia? — ${data.businessName}`
                break

            default:
                return NextResponse.json({ error: 'Tipo de email no válido' }, { status: 400 })
        }

        const { data: emailData, error } = await resend.emails.send({
            from: `${data.businessName || 'Tu GlowUp'} <notificaciones@tu-glowup.com>`,
            to: [to],
            subject,
            html,
        })

        if (error) {
            console.error('Resend error:', JSON.stringify(error))
            return NextResponse.json({ error: 'Error enviando email' }, { status: 500 })
        }

        return NextResponse.json({ success: true, id: emailData?.id })
    } catch (err) {
        console.error('Email API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
