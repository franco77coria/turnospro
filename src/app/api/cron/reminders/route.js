export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { reminderEmail } from '@/lib/email-templates'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

// This endpoint is called by Vercel Cron
// Runs every hour to check for upcoming appointments in the next 2 hours
// Timezone-aware: converts UTC to Argentina timezone before comparing
export async function GET(request) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const resend = new Resend(process.env.RESEND_API_KEY)

    try {
        // Get current time in Argentina timezone (UTC-3)
        const now = new Date()
        const argentinaOffset = -3 * 60 // UTC-3 in minutes
        const utcOffset = now.getTimezoneOffset() // local offset in minutes
        const argentinaNow = new Date(now.getTime() + (utcOffset + argentinaOffset) * 60000)
        const twoHoursLater = new Date(argentinaNow.getTime() + 2 * 60 * 60 * 1000)

        const today = argentinaNow.toISOString().split('T')[0]
        const tomorrow = new Date(argentinaNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        const currentMinutes = argentinaNow.getHours() * 60 + argentinaNow.getMinutes()
        const reminderMinutes = twoHoursLater.getHours() * 60 + twoHoursLater.getMinutes()

        // Fetch today's confirmed appointments that haven't been reminded yet
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                *,
                businesses:business_id (name, business_type, phone),
                clients:client_id (name, email, phone)
            `)
            .in('date', [today, tomorrow])
            .eq('status', 'confirmed')
            .or('reminder_sent.is.null,reminder_sent.eq.false')

        if (error) throw error

        // Filter appointments that are within the next 2 hours
        const eligible = (appointments || []).filter(apt => {
            const [aptH, aptM] = apt.time.split(':').map(Number)
            const aptMinutes = aptH * 60 + (aptM || 0)

            // If appointment is today, check if it's within 2 hours from now
            if (apt.date === today) {
                return aptMinutes >= currentMinutes && aptMinutes <= reminderMinutes
            }
            
            // If appointment is tomorrow and we're late at night, 
            // check early morning appointments for tomorrow
            if (apt.date === tomorrow && currentMinutes > (22 * 60)) {
                const minsUntilMidnight = (24 * 60) - currentMinutes
                return aptMinutes <= (120 - minsUntilMidnight) // remaining window after midnight
            }

            return false
        })

        if (!eligible.length) {
            return NextResponse.json({
                success: true,
                sent: 0,
                total: 0,
                message: 'No appointments to remind',
                checked_at: argentinaNow.toISOString(),
            })
        }

        // Process emails in parallel with Promise.allSettled
        const results = await Promise.allSettled(eligible.map(async (apt) => {
            if (!apt.clients?.email) return { skipped: true, id: apt.id, reason: 'no email' }

            const [aptH, aptM] = apt.time.split(':').map(Number)
            const aptMinutes = aptH * 60 + (aptM || 0)
            const hoursUntil = Math.max(1, Math.round((aptMinutes - currentMinutes) / 60))

            const date = new Date(apt.date)
            const formattedDate = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

            const html = reminderEmail({
                clientName: apt.clients.name || 'Cliente',
                serviceName: apt.service_name || 'Turno',
                date: formattedDate,
                time: apt.time,
                hoursUntil,
                businessName: apt.businesses?.name || 'GLOWUP',
                businessType: apt.businesses?.business_type || 'custom',
                businessPhone: apt.businesses?.phone,
                appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/appointments`,
            })

            await resend.emails.send({
                from: 'GLOWUP <onboarding@resend.dev>',
                to: [apt.clients.email],
                subject: `Recordatorio — Tu turno es ${hoursUntil <= 1 ? 'en menos de 1 hora' : `en ${hoursUntil} horas`} | ${apt.businesses?.name}`,
                html,
            })

            // Mark reminder as sent
            await supabase
                .from('appointments')
                .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
                .eq('id', apt.id)

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
            checked_at: argentinaNow.toISOString(),
        })
    } catch (err) {
        console.error('Cron reminder error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
