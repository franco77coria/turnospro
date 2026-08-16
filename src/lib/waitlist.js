import { sendWhatsAppText } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/send-email'
import { formatDateEs } from '@/lib/scheduling'

/**
 * Notify waitlist entries when a slot becomes available (cancellation).
 *
 * Antes solo intentaba WhatsApp y marcaba `notified: true` pase lo que pase.
 * Como el canal de WhatsApp está apagado en este proyecto, la lista de espera
 * se consumía sin avisarle a nadie: la persona quedaba marcada como notificada
 * y no volvía a recibir aviso nunca más. Ahora el email es el canal principal
 * y la marca solo se pone si algún canal salió bien.
 */
export async function notifyWaitlist(supabase, {
    businessId,
    date,
    teamMemberId,
    serviceName,
    businessName,
    businessSlug,
    phoneNumberId,
}) {
    try {
        // Find matching waitlist entries (not yet notified, same date)
        const { data: entries, error } = await supabase
            .from('waitlist')
            .select('*')
            .eq('business_id', businessId)
            .eq('date', date)
            .eq('notified', false)

        if (error || !entries?.length) return { notified: 0 }

        // Filter: match team_member_id if specified, or entries with no preference
        const matches = entries.filter(entry =>
            !entry.team_member_id || !teamMemberId || entry.team_member_id === teamMemberId
        )

        if (!matches.length) return { notified: 0 }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const bookingLink = businessSlug
            ? `${appUrl}/book/s/${businessSlug}`
            : `${appUrl}/book/${businessId}`

        const formattedDate = formatDateEs(date)

        let notifiedCount = 0
        let failed = 0

        for (const entry of matches) {
            let delivered = false

            if (entry.client_email) {
                try {
                    const result = await sendEmail({
                        type: 'waitlist_slot',
                        to: entry.client_email,
                        data: {
                            clientName: entry.client_name || 'Hola',
                            serviceName: serviceName || entry.service_name,
                            date: formattedDate,
                            businessName: businessName || 'el negocio',
                            bookUrl: bookingLink,
                        },
                    })
                    if (result?.success || result?.id) delivered = true
                } catch (err) {
                    console.error('Waitlist email error:', err?.message)
                }
            }

            if (phoneNumberId && entry.client_phone) {
                try {
                    await sendWhatsAppText({
                        to: entry.client_phone,
                        text: `Se libero un turno${serviceName ? ` de ${serviceName}` : ''} el ${formattedDate} en ${businessName || 'tu negocio favorito'}. Reservalo antes de que se ocupe: ${bookingLink}`,
                        phoneNumberId,
                    })
                    delivered = true
                } catch (err) {
                    console.error('Waitlist WhatsApp error:', err?.message)
                }
            }

            // Sin entrega confirmada la entrada queda pendiente para el próximo intento.
            if (!delivered) {
                failed++
                continue
            }

            const { error: markErr } = await supabase
                .from('waitlist')
                .update({ notified: true })
                .eq('id', entry.id)

            if (markErr) {
                console.error('Waitlist mark-notified error:', markErr.message)
                continue
            }
            notifiedCount++
        }

        if (failed > 0) {
            console.warn(`notifyWaitlist: ${failed} de ${matches.length} entradas sin canal de aviso disponible`)
        }

        return { notified: notifiedCount, failed }
    } catch (err) {
        console.error('notifyWaitlist error:', err)
        return { notified: 0 }
    }
}
