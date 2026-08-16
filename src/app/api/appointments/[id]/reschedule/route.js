export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { sendEmail } from '@/lib/send-email'
import { checkRescheduleAvailability } from '@/lib/availability'
import { DEFAULT_DURATION } from '@/lib/scheduling'
import { z } from 'zod'

const RescheduleSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:MM)'),
})

export async function POST(request, { params }) {
    try {
        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: 'ID de turno no especificado' }, { status: 400 })
        }

        const body = await request.json().catch(() => null)
        const parseResult = RescheduleSchema.safeParse(body)
        if (!parseResult.success) {
            return NextResponse.json({ error: 'Fecha u hora inválida', issues: parseResult.error.issues }, { status: 400 })
        }

        const { date: newDate, time: newTime } = parseResult.data

        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        const supabase = createSupabaseAdmin()

        // 1. Fetch appointment details
        const { data: apt, error: fetchErr } = await supabase
            .from('appointments')
            .select(`
                *,
                businesses:business_id (id, name, owner_id, phone, settings, business_type),
                clients:client_id (id, name, email, phone)
            `)
            .eq('id', id)
            .maybeSingle()

        if (fetchErr || !apt) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
        }

        if (apt.status === 'cancelled') {
            return NextResponse.json({ error: 'No se puede reprogramar un turno cancelado' }, { status: 400 })
        }

        // 2. Auth Guard
        let isAuthorized = false
        if (user) {
            const userEmail = user.email?.toLowerCase()
            const clientEmail = apt.clients?.email?.toLowerCase()
            const isOwner = apt.businesses?.owner_id === user.id
            const isClient = clientEmail && userEmail === clientEmail

            if (isOwner || isClient) {
                isAuthorized = true
            }
        }

        // Si no está logueado o no coincide por token/sesión, denegar
        if (!isAuthorized && !user) {
            // Permitir reprogramar si la petición viene del cliente directo (con email de sesión o guest match)
            if (body?.guest_email && apt.clients?.email && body.guest_email.toLowerCase() === apt.clients.email.toLowerCase()) {
                isAuthorized = true
            }
        }

        if (!isAuthorized) {
            return NextResponse.json({ error: 'No tenés permisos para reprogramar este turno' }, { status: 403 })
        }

        // 3. Verify availability for the requested new slot.
        // Se compara por rango real (hora + duración), no por hora exacta.
        const { available, reason } = await checkRescheduleAvailability(supabase, {
            businessId: apt.business_id,
            date: newDate,
            time: newTime,
            duration: apt.duration || DEFAULT_DURATION,
            teamMemberId: apt.team_member_id,
            excludeId: id,
            bufferTime: parseInt(apt.businesses?.settings?.buffer_time, 10) || 0,
        })

        if (!available) {
            return NextResponse.json(
                { error: reason || 'El horario seleccionado ya no se encuentra disponible. Elegí otro horario.' },
                { status: 409 }
            )
        }

        // 4. Update appointment with new date and time
        const { data: updatedApt, error: updateErr } = await supabase
            .from('appointments')
            // `appointments` no tiene columna updated_at: incluirla hacía que
            // Postgres rechazara el UPDATE (42703) y la reprogramación
            // devolviera 500 siempre.
            .update({
                date: newDate,
                time: newTime,
            })
            .eq('id', id)
            .select()
            .single()

        if (updateErr) {
            throw updateErr
        }

        // 5. Send Reschedule Email Notifications
        const [y, m, d] = newDate.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        const formattedDateLong = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

        const clientEmail = apt.clients?.email || user?.email
        const clientName = apt.clients?.name || 'Cliente'
        const businessName = apt.businesses?.name || 'Tu GlowUp'

        // Email al cliente
        if (clientEmail) {
            await sendEmail({
                type: 'confirmation',
                to: clientEmail,
                data: {
                    clientName,
                    serviceName: apt.service_name,
                    date: `${formattedDateLong} (REPROGRAMADO)`,
                    time: newTime,
                    duration: apt.duration,
                    businessName,
                    businessType: apt.businesses?.business_type || 'custom',
                    businessPhone: apt.businesses?.phone,
                    appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/book/my-appointments`,
                    appointmentId: id,
                }
            }).catch(e => console.error('Error enviando email de reprogramación al cliente:', e))
        }

        // Email al dueño del negocio
        if (apt.businesses?.owner_id) {
            try {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('id', apt.businesses.owner_id)
                    .maybeSingle()

                if (ownerProfile?.email) {
                    await sendEmail({
                        type: 'new_booking_notify',
                        to: ownerProfile.email,
                        data: {
                            clientName: `${clientName} (REPROGRAMADO)`,
                            clientEmail,
                            clientPhone: apt.clients?.phone,
                            serviceName: apt.service_name,
                            date: formattedDateLong,
                            time: newTime,
                            duration: apt.duration,
                            businessName,
                            businessType: apt.businesses?.business_type || 'custom',
                            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/dashboard/appointments`,
                        }
                    }).catch(e => console.error('Error enviando email de reprogramación al dueño:', e))
                }
            } catch (e) {
                console.error('Error al buscar ownerProfile para reprogramación:', e)
            }
        }

        return NextResponse.json({
            success: true,
            appointment: updatedApt,
            message: 'Turno reprogramado exitosamente'
        })
    } catch (err) {
        console.error('POST /api/appointments/[id]/reschedule error:', err)
        return NextResponse.json({ error: err.message || 'Error al reprogramar turno' }, { status: 500 })
    }
}
