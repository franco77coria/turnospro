import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { confirmationEmail, reminderEmail, welcomeEmail } from '@/lib/email-templates'

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

            default:
                return NextResponse.json({ error: 'Tipo de email no válido' }, { status: 400 })
        }

        const { data: emailData, error } = await resend.emails.send({
            from: `${data.businessName} <turnos@turnospro.app>`,
            to: [to],
            subject,
            html,
        })

        if (error) {
            console.error('Resend error:', error)
            // If domain not verified, use Resend's onboarding email
            if (error.message?.includes('domain')) {
                const { data: fallbackData, error: fallbackError } = await resend.emails.send({
                    from: 'TurnosPro <onboarding@resend.dev>',
                    to: [to],
                    subject,
                    html,
                })

                if (fallbackError) {
                    return NextResponse.json({ error: fallbackError.message }, { status: 500 })
                }
                return NextResponse.json({ success: true, id: fallbackData?.id, fallback: true })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, id: emailData?.id })
    } catch (err) {
        console.error('Email API error:', err)
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
    }
}
