import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { checkRescheduleAvailability } from '@/lib/availability'
import { DEFAULT_DURATION } from '@/lib/scheduling'
import { z } from 'zod'

const UpdateSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Hora inválida (HH:MM)').optional(),
    service_name: z.string().trim().min(1).max(200).optional(),
    duration: z.coerce.number().int().min(5).max(480).optional(),
    price: z.coerce.number().nonnegative().max(10_000_000).optional(),
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
    notes: z.string().trim().max(1000).nullish(),
})

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

        const raw = await request.json().catch(() => ({}))
        const parsed = UpdateSchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', issues: parsed.error.issues },
                { status: 400 }
            )
        }
        const updates = parsed.data
        const supabase = createSupabaseAdmin()

        // 1. Fetch existing appointment & business to verify rights
        const { data: appointment, error: fetchErr } = await supabase
            .from('appointments')
            .select('*, businesses(owner_id, name, phone, settings)')
            .eq('id', id)
            .single()

        if (fetchErr || !appointment) {
            return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
        }

        // El dueño o cualquier miembro activo del equipo puede editar.
        // Antes solo el dueño: un profesional editando desde su calendario recibía 403.
        let authorized = appointment.businesses?.owner_id === user.id
        if (!authorized) {
            const { data: member } = await supabase
                .from('team_members')
                .select('id')
                .eq('business_id', appointment.business_id)
                .eq('user_id', user.id)
                .eq('active', true)
                .maybeSingle()
            authorized = !!member
        }
        if (!authorized) {
            return NextResponse.json({ error: 'No tenés permisos para modificar este turno' }, { status: 403 })
        }

        // 2. Si cambia el horario o la duración, revalidar que entre.
        //    Antes se guardaba sin chequear nada: dos clics y se pisaban turnos.
        const movesInTime = updates.date !== undefined || updates.time !== undefined || updates.duration !== undefined
        const staysActive = (updates.status ?? appointment.status) !== 'cancelled'
            && (updates.status ?? appointment.status) !== 'no_show'

        if (movesInTime && staysActive) {
            const { available, reason } = await checkRescheduleAvailability(supabase, {
                businessId: appointment.business_id,
                date: updates.date ?? appointment.date,
                time: updates.time ?? appointment.time,
                duration: updates.duration ?? appointment.duration ?? DEFAULT_DURATION,
                teamMemberId: appointment.team_member_id,
                excludeId: id,
                bufferTime: parseInt(appointment.businesses?.settings?.buffer_time, 10) || 0,
            })
            if (!available) {
                return NextResponse.json({ error: reason }, { status: 409 })
            }
        }

        // 3. Perform update
        const allowedUpdates = {}
        for (const key of ['date', 'time', 'service_name', 'status', 'duration', 'price']) {
            if (updates[key] !== undefined) allowedUpdates[key] = updates[key]
        }
        if (updates.notes !== undefined) allowedUpdates.notes = updates.notes

        if (Object.keys(allowedUpdates).length === 0) {
            return NextResponse.json({ error: 'No hay cambios para guardar' }, { status: 400 })
        }

        const { data: updatedApt, error: updateErr } = await supabase
            .from('appointments')
            .update(allowedUpdates)
            .eq('id', id)
            .select()
            .single()

        if (updateErr) {
            // La constraint de exclusión es la última línea de defensa contra
            // dos ediciones simultáneas que terminan superpuestas.
            if (updateErr.code === '23P01') {
                return NextResponse.json({ error: 'Ese horario se superpone con otro turno' }, { status: 409 })
            }
            throw updateErr
        }

        // 4. Notify client via email if date or time changed
        if ((updates.date || updates.time) && appointment.client_id) {
            const { data: client } = await supabase
                .from('clients')
                .select('name, email')
                .eq('id', appointment.client_id)
                .single()

            if (client?.email) {
                const { sendEmail } = await import('@/lib/send-email')
                const dateStr = updates.date || appointment.date
                const [y, m, d] = dateStr.split('-').map(Number)
                const formattedDate = new Date(y, m - 1, d)
                    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
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
        return NextResponse.json({ error: 'Error al actualizar turno' }, { status: 500 })
    }
}
