export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { reminderEmail } from '@/lib/email-templates'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronAuth } from '@/lib/cron-auth'
import { hoursUntilSlot, nowInTimezone } from '@/lib/timezone'
import { formatDateEs, formatDateLocal } from '@/lib/scheduling'
import { appUrl } from '@/lib/app-url'

// This endpoint is called by Vercel Cron
// Runs every hour to check for upcoming appointments in the next 2 hours.
// Email is the only automated channel until WhatsApp is configured.
// Timezone-aware: converts UTC to Argentina timezone before comparing
export async function GET(request) {
    const unauth = verifyCronAuth(request)
    if (unauth) return unauth

    const supabase = createSupabaseAdmin()
    const resend = new Resend(process.env.RESEND_API_KEY)

    try {
        // Hora de Argentina calculada con la base de zonas horarias, no con un
        // offset a mano: el truco anterior mezclaba getTimezoneOffset() del
        // runtime con toISOString(), y daba la fecha equivocada fuera de UTC.
        const argentinaNow = nowInTimezone()
        const today = formatDateLocal(argentinaNow)
        const from = new Date(argentinaNow)
        from.setDate(from.getDate() - 1)
        const to = new Date(argentinaNow)
        to.setDate(to.getDate() + 2)

        // Turnos próximos sin recordatorio enviado.
        // Incluye 'pending': los turnos reservados desde la web se crean así, y
        // al filtrar solo por 'confirmed' NUNCA recibían recordatorio.
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                *,
                businesses:business_id (name, business_type, phone, settings, timezone),
                clients:client_id (name, email)
            `)
            .gte('date', formatDateLocal(from))
            .lte('date', formatDateLocal(to))
            .in('status', ['pending', 'confirmed'])
            .or('reminder_sent.is.null,reminder_sent.eq.false')

        if (error) throw error

        // Every business uses its own wall clock; the server may run in UTC.
        const eligible = (appointments || []).filter(apt => {
            const hours = hoursUntilSlot(apt.date, apt.time, apt.businesses?.timezone || undefined)
            return hours >= 0 && hours <= 2
        })

        if (!eligible.length) {
            return NextResponse.json({
                success: true,
                sent: 0,
                total: 0,
                message: 'No appointments to remind',
                checked_at: `${today} ${String(argentinaNow.getHours()).padStart(2, '0')}:${String(argentinaNow.getMinutes()).padStart(2, '0')} (AR)`,
            })
        }

        // Only mark a reminder as sent after Resend accepts it. Otherwise the
        // next cron run retries it instead of silently losing the reminder.
        const results = await Promise.allSettled(eligible.map(async (apt) => {
            if (!apt.clients?.email) return { skipped: true, id: apt.id, reason: 'no email' }

            const hoursUntil = Math.max(1, Math.ceil(hoursUntilSlot(apt.date, apt.time, apt.businesses?.timezone || undefined)))

            const formattedDate = formatDateEs(apt.date)

            const html = reminderEmail({
                clientName: apt.clients.name || 'Cliente',
                serviceName: apt.service_name || 'Turno',
                date: formattedDate,
                time: apt.time,
                hoursUntil,
                businessName: apt.businesses?.name || 'GLOWUP',
                businessType: apt.businesses?.business_type || 'custom',
                businessPhone: apt.businesses?.phone,
                appointmentUrl: `${appUrl()}/book/my-appointments`,
            })

            const { error: sendError } = await resend.emails.send({
                from: `${apt.businesses?.name || 'Tu GlowUp'} <notificaciones@tu-glowup.com>`,
                to: [apt.clients.email],
                subject: `Recordatorio — Tu turno es ${hoursUntil <= 1 ? 'en menos de 1 hora' : `en ${hoursUntil} horas`} | ${apt.businesses?.name}`,
                html,
            })
            if (sendError) throw sendError

            const { error: updateError } = await supabase.from('appointments')
                .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
                .eq('id', apt.id)
            if (updateError) throw updateError
            return { sent: true, id: apt.id }
        }))

        const sentCount = results.filter(r => r.status === 'fulfilled' && r.value?.sent).length
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => ({ error: r.reason?.message || 'Unknown error' }))

        return NextResponse.json({
            success: true,
            sent: sentCount,
            total: eligible.length,
            errors: errors.length > 0 ? errors : undefined,
            checked_at: `${today} ${String(argentinaNow.getHours()).padStart(2, '0')}:${String(argentinaNow.getMinutes()).padStart(2, '0')} (AR)`,
        })
    } catch (err) {
        console.error('Cron reminder error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
