import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendWhatsAppMessage, sendWhatsAppText } from '@/lib/whatsapp'
import { applyRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const limited = applyRateLimit(request, { prefix: 'whatsapp', limit: 20, windowMs: 60000 })
    if (limited) return limited

    const { to, type, data } = await request.json()
    if (!to || !type || !data) {
      return NextResponse.json({ error: 'Missing required fields: to, type, data' }, { status: 400 })
    }

    // Get business WhatsApp config
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient(cookieStore)

    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    // If business has its own WhatsApp config, use that
    if (data.businessId) {
      const { data: business } = await supabase
        .from('businesses')
        .select('whatsapp_phone, settings')
        .eq('id', data.businessId)
        .single()

      if (business?.settings?.whatsapp_phone_number_id) {
        phoneNumberId = business.settings.whatsapp_phone_number_id
      }
    }

    let result

    switch (type) {
      case 'appointment_confirmation':
        result = await sendWhatsAppText({
          to,
          phoneNumberId,
          text: `Turno confirmado\n\n${data.serviceName}\n${data.date} a las ${data.time}\n${data.businessName}\n\nPara cancelar, responde CANCELAR.`
        })
        break

      case 'appointment_reminder':
        result = await sendWhatsAppText({
          to,
          phoneNumberId,
          text: `Recordatorio de turno\n\nTenes turno hoy:\n${data.serviceName}\n${data.time}\n${data.businessName}\n\nResponde CANCELAR si no podes asistir.`
        })
        break

      case 'new_booking_notify':
        result = await sendWhatsAppText({
          to,
          phoneNumberId,
          text: `Nueva reserva\n\n${data.clientName}\n${data.serviceName}\n${data.date} a las ${data.time}`
        })
        break

      case 'cancellation':
        result = await sendWhatsAppText({
          to,
          phoneNumberId,
          text: `Turno cancelado\n\nSe cancelo tu turno de ${data.serviceName} del ${data.date} a las ${data.time} en ${data.businessName}.\n\nPodes reservar uno nuevo en cualquier momento.`
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
