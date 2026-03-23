import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { notifyWaitlist } from '@/lib/waitlist'

export const dynamic = 'force-dynamic'

// Webhook verification (GET)
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Receive messages (POST)
export async function POST(request) {
  try {
    const body = await request.json()

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' })
    }

    const supabase = createSupabaseAdmin()

    for (const message of messages) {
      const from = message.from // phone number
      const text = message.text?.body?.trim().toUpperCase()

      if (text === 'CANCELAR') {
        // Find the next upcoming appointment for this phone number
        const today = new Date().toISOString().split('T')[0]

        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', from)
          .single()

        if (client) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('id, service_name, date, time, business_id')
            .eq('client_id', client.id)
            .in('status', ['pending', 'confirmed'])
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(1)
            .single()

          if (appointment) {
            await supabase
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', appointment.id)

            // Track monthly cancellations
            try {
              const currentMonth = new Date().toISOString().slice(0, 7)
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

            // Send confirmation of cancellation
            const { sendWhatsAppText } = await import('@/lib/whatsapp')
            await sendWhatsAppText({
              to: from,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              text: `Tu turno de ${appointment.service_name} del ${appointment.date} a las ${appointment.time} fue cancelado exitosamente.`
            }).catch(() => {})

            // Notify waitlist
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

      if (text === 'CONFIRMO' || text === 'CONFIRMAR') {
        const today = new Date().toISOString().split('T')[0]

        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', from)
          .single()

        if (client) {
          // Clear confirmation flags and confirm appointment
          await supabase
            .from('appointments')
            .update({
              status: 'confirmed',
              confirmation_required: false,
              confirmation_deadline: null,
            })
            .eq('client_id', client.id)
            .in('status', ['pending', 'confirmed'])
            .gte('date', today)

          // Send confirmation ack
          const { sendWhatsAppText } = await import('@/lib/whatsapp')
          await sendWhatsAppText({
            to: from,
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
            text: 'Tu turno fue confirmado exitosamente. ¡Te esperamos!'
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ status: 'processed' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
