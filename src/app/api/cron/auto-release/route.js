export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { notifyWaitlist } from '@/lib/waitlist'
import { verifyCronAuth } from '@/lib/cron-auth'

// Runs every 30 minutes via Vercel Cron
// Finds appointments where confirmation_deadline has passed
// and the client didn't confirm → cancels them and notifies waitlist
export async function GET(request) {
    const unauth = verifyCronAuth(request)
    if (unauth) return unauth

    const supabase = createSupabaseAdmin()

    try {
        const now = new Date().toISOString()

        // Find appointments with expired confirmation deadline
        const { data: expired, error } = await supabase
            .from('appointments')
            .select('id, business_id, date, time, service_name, team_member_id, client_id, businesses:business_id (name, slug, settings)')
            .eq('confirmation_required', true)
            .lt('confirmation_deadline', now)
            .in('status', ['pending', 'confirmed'])

        if (error) throw error
        if (!expired || expired.length === 0) {
            return NextResponse.json({ success: true, released: 0 })
        }

        let released = 0

        for (const apt of expired) {
            // Cancel the appointment
            await supabase
                .from('appointments')
                .update({
                    status: 'cancelled',
                    confirmation_required: false,
                    confirmation_deadline: null,
                })
                .eq('id', apt.id)

            // Notify client via WhatsApp
            if (apt.client_id) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('phone, name')
                    .eq('id', apt.client_id)
                    .single()

                if (client?.phone) {
                    try {
                        const { sendWhatsAppText } = await import('@/lib/whatsapp')
                        const phoneNumberId = apt.businesses?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID
                        await sendWhatsAppText({
                            to: client.phone,
                            phoneNumberId,
                            text: `Hola ${client.name || 'Cliente'}, tu turno de ${apt.service_name} del ${apt.date} a las ${apt.time?.slice(0, 5)} fue liberado porque no recibimos tu confirmación a tiempo. Podés volver a reservar desde la app.`
                        })
                    } catch (err) {
                        console.error('WhatsApp auto-release notification failed:', err)
                    }
                }
            }

            // Notify waitlist
            try {
                await notifyWaitlist(supabase, {
                    businessId: apt.business_id,
                    date: apt.date,
                    teamMemberId: apt.team_member_id,
                    serviceName: apt.service_name,
                    businessName: apt.businesses?.name,
                    businessSlug: apt.businesses?.slug,
                    phoneNumberId: apt.businesses?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID,
                })
            } catch (err) {
                console.error('Waitlist auto-release notification failed:', err)
            }

            released++
        }

        return NextResponse.json({ success: true, released, total: expired.length })
    } catch (err) {
        console.error('Auto-release cron error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
