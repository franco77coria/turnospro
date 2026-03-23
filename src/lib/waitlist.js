import { sendWhatsAppText } from '@/lib/whatsapp'

/**
 * Notify waitlist entries when a slot becomes available (cancellation).
 * Sends WhatsApp message to matching entries and marks them as notified.
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
        let query = supabase
            .from('waitlist')
            .select('*')
            .eq('business_id', businessId)
            .eq('date', date)
            .eq('notified', false)

        const { data: entries, error } = await query
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

        const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long'
        })

        let notifiedCount = 0

        for (const entry of matches) {
            const message = `Se libero un turno${serviceName ? ` de ${serviceName}` : ''} el ${formattedDate} en ${businessName || 'tu negocio favorito'}. Reservalo antes de que se ocupe: ${bookingLink}`

            try {
                // Try WhatsApp first
                if (phoneNumberId && entry.client_phone) {
                    await sendWhatsAppText({
                        to: entry.client_phone,
                        text: message,
                        phoneNumberId,
                    })
                }

                // Mark as notified
                await supabase
                    .from('waitlist')
                    .update({ notified: true })
                    .eq('id', entry.id)

                notifiedCount++
            } catch (err) {
                console.error(`Waitlist notify error for ${entry.client_phone}:`, err)
            }
        }

        return { notified: notifiedCount }
    } catch (err) {
        console.error('notifyWaitlist error:', err)
        return { notified: 0 }
    }
}
