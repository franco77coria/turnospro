export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { reminderEmail } from '@/lib/email-templates'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyCronAuth } from '@/lib/cron-auth'
import { nowInTimezone } from '@/lib/timezone'
import { formatDateEs, formatDateLocal } from '@/lib/scheduling'

// This endpoint is called by Vercel Cron
// Runs every hour to check for upcoming appointments in the next 2 hours
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
        const twoHoursLater = new Date(argentinaNow.getTime() + 2 * 60 * 60 * 1000)

        const today = formatDateLocal(argentinaNow)
        const tomorrow = formatDateLocal(new Date(argentinaNow.getTime() + 24 * 60 * 60 * 1000))

        const currentMinutes = argentinaNow.getHours() * 60 + argentinaNow.getMinutes()
        const reminderMinutes = twoHoursLater.getHours() * 60 + twoHoursLater.getMinutes()

        // Turnos próximos sin recordatorio enviado.
        // Incluye 'pending': los turnos reservados desde la web se crean así, y
        // al filtrar solo por 'confirmed' NUNCA recibían recordatorio.
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                *,
                businesses:business_id (name, business_type, phone, settings),
                clients:client_id (name, email, phone, monthly_cancellations, last_cancellation_month)
            `)
            .in('date', [today, tomorrow])
            .in('status', ['pending', 'confirmed'])
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
                checked_at: `${today} ${String(argentinaNow.getHours()).padStart(2, '0')}:${String(argentinaNow.getMinutes()).padStart(2, '0')} (AR)`,
            })
        }

        // Process emails in parallel with Promise.allSettled
        const results = await Promise.allSettled(eligible.map(async (apt) => {
            if (!apt.clients?.email) return { skipped: true, id: apt.id, reason: 'no email' }

            const [aptH, aptM] = apt.time.split(':').map(Number)
            const aptMinutes = aptH * 60 + (aptM || 0)
            const hoursUntil = Math.max(1, Math.round((aptMinutes - currentMinutes) / 60))

            const formattedDate = formatDateEs(apt.date)

            let whatsappSent = false
            let emailSent = false

            // 1. WhatsApp, si el negocio lo tiene configurado.
            // El pedido de confirmación ("respondé CONFIRMO o se libera el turno")
            // se sacó: la feature no está en uso.
            if (apt.clients.phone) {
                try {
                    const { sendWhatsAppText } = await import('@/lib/whatsapp')
                    const phoneNumberId = apt.businesses?.settings?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID

                    await sendWhatsAppText({
                        to: apt.clients.phone,
                        phoneNumberId,
                        text: `Hola ${apt.clients.name || 'Cliente'}, te recordamos tu turno de ${apt.service_name || 'turno'} el ${formattedDate} a las ${apt.time?.slice(0, 5)} hs en ${apt.businesses?.name || 'GLOWUP'}.\n\n¡Te esperamos! Si no podés asistir, respondé CANCELAR.`,
                    })

                    await supabase
                        .from('appointments')
                        .update({
                            reminder_sent: true,
                            reminder_sent_at: new Date().toISOString(),
                        })
                        .eq('id', apt.id)

                    whatsappSent = true
                } catch (e) {
                    console.error('WhatsApp reminder dispatch failed:', e)
                }
            }

            // 2. Send email reminder if email exists (either as fallback or complementary)
            if (apt.clients.email) {
                try {
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
                        from: `${apt.businesses?.name || 'Tu GlowUp'} <notificaciones@tu-glowup.com>`,
                        to: [apt.clients.email],
                        subject: `Recordatorio — Tu turno es ${hoursUntil <= 1 ? 'en menos de 1 hora' : `en ${hoursUntil} horas`} | ${apt.businesses?.name}`,
                        html,
                    })

                    // If WhatsApp wasn't sent, we mark reminder as sent here
                    if (!whatsappSent) {
                        await supabase
                            .from('appointments')
                            .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
                            .eq('id', apt.id)
                    }
                    emailSent = true
                } catch (e) {
                    console.error('Email reminder dispatch failed:', e)
                }
            }

            if (whatsappSent || emailSent) {
                return {
                    sent: true,
                    id: apt.id,
                    channels: { whatsapp: whatsappSent, email: emailSent },
                }
            }
            return { sent: false, id: apt.id, reason: 'dispatch_failed_all_channels' }
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
