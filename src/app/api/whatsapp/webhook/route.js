import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

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

            // Send confirmation of cancellation
            const { sendWhatsAppText } = await import('@/lib/whatsapp')
            await sendWhatsAppText({
              to: from,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              text: `Tu turno de ${appointment.service_name} del ${appointment.date} a las ${appointment.time} fue cancelado exitosamente.`
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
          await supabase
            .from('appointments')
            .update({ status: 'confirmed' })
            .eq('client_id', client.id)
            .eq('status', 'pending')
            .gte('date', today)
        }
      }
    }

    return NextResponse.json({ status: 'processed' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
