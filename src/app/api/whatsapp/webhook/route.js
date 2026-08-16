import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { notifyWaitlist } from '@/lib/waitlist'
import { nowInTimezone } from '@/lib/timezone'
import { formatDateLocal } from '@/lib/scheduling'

export const dynamic = 'force-dynamic'

// Webhook verification (GET) — Meta hub challenge
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (mode === 'subscribe' && expected && token && token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Verify Meta webhook signature using App Secret (HMAC-SHA256)
function verifyMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signatureHeader) return false
  if (!signatureHeader.startsWith('sha256=')) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Receive messages (POST) — only after verifying Meta signature
export async function POST(request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifyMetaSignature(rawBody, signature)) {
      console.warn('WhatsApp webhook: invalid or missing signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let body
    try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' })
    }

    const supabase = createSupabaseAdmin()

    for (const message of messages) {
      const from = typeof message.from === 'string' ? message.from.replace(/[^0-9+]/g, '').slice(0, 20) : ''
      const text = typeof message.text?.body === 'string' ? message.text.body.trim().toUpperCase().slice(0, 32) : ''
      if (!from) continue

      if (text === 'CANCELAR') {
        // Fecha de Argentina: con toISOString() en un runtime UTC, después de
        // las 21:00 el filtro saltaba al día siguiente y se perdían los turnos de hoy.
        const today = formatDateLocal(nowInTimezone())

        // Un mismo teléfono puede figurar como cliente en varios negocios;
        // con .single() la consulta fallaba y el mensaje se ignoraba en silencio.
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', from)
          .limit(1)
          .maybeSingle()

        if (client) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('id, service_name, date, time, business_id, team_member_id')
            .eq('client_id', client.id)
            .in('status', ['pending', 'confirmed'])
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(1)
            .maybeSingle()

          if (appointment) {
            await supabase
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', appointment.id)

            // Track monthly cancellations
            try {
              const currentMonth = formatDateLocal(nowInTimezone()).slice(0, 7)
              const { data: clientInfo } = await supabase
                .from('clients')
                .select('monthly_cancellations, last_cancellation_month')
                .eq('id', client.id)
                .single()
              if (clientInfo) {
                const count = clientInfo.last_cancellation_month === currentMonth
                  ? (clientInfo.monthly_cancellations || 0) + 1
                  : 1
                await supabase.from('clients')
                  .update({ monthly_cancellations: count, last_cancellation_month: currentMonth })
                  .eq('id', client.id)
              }
            } catch (_) {}

            const { sendWhatsAppText } = await import('@/lib/whatsapp')
            await sendWhatsAppText({
              to: from,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              text: `Tu turno de ${appointment.service_name} del ${appointment.date} a las ${appointment.time} fue cancelado exitosamente.`
            }).catch(() => {})

            const { data: biz } = await supabase
              .from('businesses')
              .select('name, slug, settings')
              .eq('id', appointment.business_id)
              .single()

            await notifyWaitlist(supabase, {
              businessId: appointment.business_id,
              date: appointment.date,
              teamMemberId: appointment.team_member_id,
              serviceName: appointment.service_name,
              businessName: biz?.name,
              businessSlug: biz?.slug,
              phoneNumberId: biz?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID,
            }).catch(() => {})
          }
        }
      }

      // El flujo de confirmación por WhatsApp ("respondé CONFIRMO") se retiró.
      // Solo queda CANCELAR.
    }

    return NextResponse.json({ status: 'processed' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
