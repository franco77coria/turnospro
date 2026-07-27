import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function PATCH(request, { params }) {
    try {
        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: 'ID de turno no provisto' }, { status: 400 })
        }

        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const updates = await request.json().catch(() => ({}))
        const supabase = createSupabaseAdmin()

        // 1. Fetch existing appointment & business to verify owner rights
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*, businesses(owner_id, name, phone)')
            .eq('id', id)
            .single()

        if (fetchErr || !appointment) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
        }

        if (appointment.businesses?.owner_id !== user.id) {
            return NextResponse.json({ error: 'No tenés permisos para modificar este turno' }, { status: 403 })
        }

        // 2. Perform update
        const allowedUpdates = {}
        if (updates.date) allowedUpdates.date = updates.date
        if (updates.time) allowedUpdates.time = updates.time
        if (updates.service_name) allowedUpdates.service_name = updates.service_name
        if (updates.status) allowedUpdates.status = updates.status
        if (updates.notes !== undefined) allowedUpdates.notes = updates.notes
        if (updates.duration) allowedUpdates.duration = updates.duration
        if (updates.price !== undefined) allowedUpdates.price = updates.price

        const { data: updatedApt, error: updateErr } = await supabase
            .from('appointments')
            .update(allowedUpdates)
            .eq('id', id)
            .select()
            .single()

        if (updateErr) {
            throw updateErr
        }

        // 3. Notify client via email if date or time changed
        if ((updates.date || updates.time) && appointment.client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('name, email')
                .eq('id', appointment.client_id)
                .single()

            if (client?.email) {
                const { sendEmail } = await import('@/lib/send-email')
                const formattedDate = new Date(updates.date || appointment.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
                sendEmail({
                    type: 'confirmation',
                    to: client.email,
                    data: {
                        clientName: client.name || 'Cliente',
                        serviceName: updates.service_name || appointment.service_name,
                        date: formattedDate,
                        time: updates.time || appointment.time,
                        duration: updates.duration || appointment.duration,
                        businessName: appointment.businesses?.name || 'Tu GlowUp',
                        businessType: 'custom',
                        businessPhone: appointment.businesses?.phone,
                        appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.tu-glowup.com'}/book/my-appointments`,
                        appointmentId: id,
                    }
                }).catch(() => {})
            }
        }

        return NextResponse.json({ success: true, appointment: updatedApt })
    } catch (err) {
        console.error('PATCH /api/appointments/[id] error:', err)
        return NextResponse.json({ error: err.message || 'Error al actualizar turno' }, { status: 500 })
    }
}
