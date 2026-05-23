import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendWhatsAppText } from '@/lib/whatsapp'
import { applyRateLimit } from '@/lib/rate-limit'
import { WhatsAppSendSchema, parseBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

// Authenticated endpoint for the dashboard to send notification-style WhatsApps.
// Templates are pre-defined here — no arbitrary text from clients.
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const supabase = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const limited = await applyRateLimit(request, {
            prefix: `whatsapp:${user.id}`,
            limit: 20,
            windowMs: 60000,
        })
        if (limited) return limited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(WhatsAppSendSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { to, type, data } = parsed.data

        let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

        if (data.businessId && typeof data.businessId === 'string' && /^[0-9a-f-]{36}$/i.test(data.businessId)) {
            const { data: business } = await supabase
                .from('businesses')
                .select('whatsapp_phone, settings')
                .eq('id', data.businessId)
                .single()

            if (business?.settings?.whatsapp_phone_number_id) {
                phoneNumberId = business.settings.whatsapp_phone_number_id
            }
        }

        const safe = {
            serviceName: String(data.serviceName || ''),
            date: String(data.date || ''),
            time: String(data.time || ''),
            businessName: String(data.businessName || ''),
            clientName: String(data.clientName || ''),
        }

        let result
        switch (type) {
            case 'appointment_confirmation':
                result = await sendWhatsAppText({
                    to,
                    phoneNumberId,
                    text: `Turno confirmado\n\n${safe.serviceName}\n${safe.date} a las ${safe.time}\n${safe.businessName}\n\nPara cancelar, responde CANCELAR.`
                })
                break

            case 'appointment_reminder':
                result = await sendWhatsAppText({
                    to,
                    phoneNumberId,
                    text: `Recordatorio de turno\n\nTenes turno hoy:\n${safe.serviceName}\n${safe.time}\n${safe.businessName}\n\nResponde CANCELAR si no podes asistir.`
                })
                break

            case 'new_booking_notify':
                result = await sendWhatsAppText({
                    to,
                    phoneNumberId,
                    text: `Nueva reserva\n\n${safe.clientName}\n${safe.serviceName}\n${safe.date} a las ${safe.time}`
                })
                break

            case 'cancellation':
                result = await sendWhatsAppText({
                    to,
                    phoneNumberId,
                    text: `Turno cancelado\n\nSe cancelo tu turno de ${safe.serviceName} del ${safe.date} a las ${safe.time} en ${safe.businessName}.\n\nPodes reservar uno nuevo en cualquier momento.`
                })
                break

            default:
                return NextResponse.json({ error: `Unknown message type: ${type}` }, { status: 400 })
        }

        return NextResponse.json({ success: true, messageId: result?.messages?.[0]?.id })
    } catch (err) {
        console.error('WhatsApp send error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
