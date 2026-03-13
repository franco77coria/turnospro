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

        // Fetch appointment with business settings
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*, businesses:business_id (name, settings)')
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

        // Create notification for business owner
        const { data: bizData } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', appointment.business_id)
            .single()

        if (bizData?.owner_id) {
            await supabase.from('notifications').insert([{
                user_id: bizData.owner_id,
                business_id: appointment.business_id,
                type: 'appointment_cancelled',
                title: 'Turno cancelado',
                message: `${appointment.service_name} del ${appointment.date} a las ${appointment.time} fue cancelado por el cliente.`,
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
