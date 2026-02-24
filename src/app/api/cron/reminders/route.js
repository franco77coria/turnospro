import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { reminderEmail } from '@/lib/email-templates'

// This endpoint should be called by a cron job (Vercel Cron)
// Runs every hour to check for upcoming appointments in the next 2 hours
export async function GET(request) {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const resend = new Resend(process.env.RESEND_API_KEY)

    try {
        const now = new Date()
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

        const today = now.toISOString().split('T')[0]
        const currentHour = now.getHours()
        const reminderHour = twoHoursFromNow.getHours()

        // Get appointments scheduled for today/tomorrow that haven't been reminded
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                *,
                businesses:business_id (name, business_type, phone),
                clients:client_id (name, email, phone)
            `)
            .eq('date', today)
            .eq('status', 'confirmed')
            .eq('reminder_sent', false)

        if (error) throw error

        let sentCount = 0
        const errors = []

        for (const apt of (appointments || [])) {
            // Check if appointment is within 2 hours
            const [aptHour] = apt.time.split(':').map(Number)
            if (aptHour < currentHour || aptHour > reminderHour) continue
            if (!apt.clients?.email) continue

            const hoursUntil = aptHour - currentHour
            const date = new Date(apt.date)
            const formattedDate = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

            try {
                const html = reminderEmail({
                    clientName: apt.clients.name || 'Cliente',
                    serviceName: apt.service || 'Turno',
                    date: formattedDate,
                    time: apt.time,
                    hoursUntil: hoursUntil || 1,
                    businessName: apt.businesses?.name || 'TurnosPro',
                    businessType: apt.businesses?.business_type || 'custom',
                    businessPhone: apt.businesses?.phone,
                    appointmentUrl: `https://turnospro-omega.vercel.app/dashboard/appointments`,
                })

                await resend.emails.send({
                    from: 'TurnosPro <onboarding@resend.dev>',
                    to: [apt.clients.email],
                    subject: `Recordatorio — Tu turno es ${hoursUntil <= 1 ? 'en menos de 1 hora' : `en ${hoursUntil} horas`} | ${apt.businesses?.name}`,
                    html,
                })

                // Mark reminder as sent
                await supabase
                    .from('appointments')
                    .update({ reminder_sent: true })
                    .eq('id', apt.id)

                sentCount++
            } catch (emailErr) {
                errors.push({ id: apt.id, error: emailErr.message })
            }
        }

        return NextResponse.json({
            success: true,
            sent: sentCount,
            total: appointments?.length || 0,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: now.toISOString(),
        })
    } catch (err) {
        console.error('Cron reminder error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
