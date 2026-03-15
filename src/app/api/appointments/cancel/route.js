import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCancelToken } from '@/lib/cancel-token'

export async function POST(request) {
    try {
        const { token } = await request.json()
        if (!token) {
            return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
        }

        const { valid, appointmentId } = await verifyCancelToken(token)
        if (!valid || !appointmentId) {
            return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        // Fetch appointment with business settings and client info
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*, businesses:business_id (name, business_type, phone, settings, owner_id), clients:client_id (name, email)')
            .eq('id', appointmentId)
            .single()

        if (fetchErr || !appointment) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
        }

        if (appointment.status === 'cancelled') {
            return NextResponse.json({ error: 'Este turno ya fue cancelado' }, { status: 400 })
        }

        if (appointment.status === 'completed') {
            return NextResponse.json({ error: 'No se puede cancelar un turno completado' }, { status: 400 })
        }

        // Check cancellation policy (min hours before appointment)
        const minCancelHours = appointment.businesses?.settings?.min_cancel_hours ?? 2
        const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}:00`)
        const now = new Date()
        const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60)

        if (hoursUntil < minCancelHours) {
            return NextResponse.json({
                error: `No se puede cancelar con menos de ${minCancelHours} horas de anticipación. Contactá al negocio directamente.`,
            }, { status: 400 })
        }

        // Cancel the appointment
        const { error: updateErr } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', appointmentId)

        if (updateErr) throw updateErr

        const formattedDate = new Date(appointment.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        const formattedTime = appointment.time?.slice(0, 5)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

        // Send cancellation email to client
        if (appointment.clients?.email) {
            try {
                await fetch(`${appUrl}/api/email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'cancellation',
                        to: appointment.clients.email,
                        data: {
                            clientName: appointment.clients.name || 'Cliente',
                            serviceName: appointment.service_name,
                            date: formattedDate,
                            time: formattedTime,
                            businessName: appointment.businesses?.name || 'GLOWUP',
                            businessType: appointment.businesses?.business_type || 'custom',
                            businessPhone: appointment.businesses?.phone,
                            bookUrl: `${appUrl}/book/${appointment.business_id}`,
                        }
                    })
                })
            } catch (e) {
                console.error('Cancel email to client failed:', e)
            }
        }

        // Send notification email to business owner + in-app notification
        const ownerId = appointment.businesses?.owner_id
        if (ownerId) {
            // Get owner email
            const { data: ownerProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', ownerId)
                .single()

            if (ownerProfile?.email) {
                try {
                    await fetch(`${appUrl}/api/email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'cancellation_notify',
                            to: ownerProfile.email,
                            data: {
                                clientName: appointment.clients?.name || 'Cliente',
                                clientEmail: appointment.clients?.email,
                                serviceName: appointment.service_name,
                                date: formattedDate,
                                time: formattedTime,
                                businessName: appointment.businesses?.name || 'GLOWUP',
                                businessType: appointment.businesses?.business_type || 'custom',
                                dashboardUrl: `${appUrl}/dashboard/appointments`,
                            }
                        })
                    })
                } catch (e) {
                    console.error('Cancel notify email to business failed:', e)
                }
            }

            // In-app notification
            await supabase.from('notifications').insert([{
                user_id: ownerId,
                business_id: appointment.business_id,
                type: 'appointment_cancelled',
                title: 'Turno cancelado',
                message: `${appointment.clients?.name || 'Un cliente'} canceló ${appointment.service_name} del ${formattedDate} a las ${formattedTime}.`,
            }]).catch(() => {}) // non-critical
        }

        return NextResponse.json({
            success: true,
            message: 'Turno cancelado exitosamente',
            appointment: {
                service_name: appointment.service_name,
                date: appointment.date,
                time: appointment.time,
                business_name: appointment.businesses?.name,
            },
        })
    } catch (err) {
        console.error('Cancel appointment error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

