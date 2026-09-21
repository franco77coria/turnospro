import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { applyRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/send-email'
import { formatDateEs } from '@/lib/scheduling'
import { appUrl } from '@/lib/app-url'

// Dashboard-only resend. The recipient and every template value are read from
// the appointment, never from a browser-supplied email or arbitrary data map.
const RequestSchema = z.object({
    appointmentId: z.string().uuid(),
    type: z.enum(['confirmation', 'cancellation']),
}).strict()

export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const limited = await applyRateLimit(request, {
            prefix: `appointment-email:${user.id}`, limit: 10, windowMs: 60_000,
        })
        if (limited) return limited

        const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

        const supabase = createSupabaseAdmin()
        const { data: apt, error } = await supabase
            .from('appointments')
            .select('id, business_id, client_id, status, date, time, duration, service_name, businesses:business_id (id, owner_id, name, business_type, phone), clients:client_id (name, email)')
            .eq('id', parsed.data.appointmentId)
            .maybeSingle()
        if (error) throw error
        if (!apt) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })

        let allowed = apt.businesses?.owner_id === user.id
        if (!allowed) {
            const { data: member } = await supabase.from('team_members')
                .select('id').eq('business_id', apt.business_id)
                .eq('user_id', user.id).eq('active', true).maybeSingle()
            allowed = Boolean(member)
        }
        if (!allowed) return NextResponse.json({ error: 'Sin permisos para este negocio' }, { status: 403 })

        if ((parsed.data.type === 'cancellation') !== (apt.status === 'cancelled')) {
            return NextResponse.json({ error: 'El estado del turno no coincide con el email solicitado' }, { status: 409 })
        }
        if (!apt.clients?.email) return NextResponse.json({ error: 'El cliente no tiene email' }, { status: 409 })

        const biz = apt.businesses
        const result = await sendEmail({
            type: parsed.data.type,
            to: apt.clients.email,
            data: {
                clientName: apt.clients.name || 'Cliente',
                serviceName: apt.service_name,
                date: formatDateEs(apt.date),
                time: apt.time,
                duration: apt.duration,
                businessName: biz?.name || 'GLOWUP',
                businessType: biz?.business_type || 'custom',
                businessPhone: biz?.phone,
                appointmentUrl: `${appUrl()}/book/my-appointments`,
                bookUrl: `${appUrl()}/book/${apt.business_id}`,
                appointmentId: parsed.data.type === 'confirmation' ? apt.id : undefined,
            },
        })
        if (result?.error) throw new Error(result.error)
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Appointment email error:', err)
        return NextResponse.json({ error: 'No se pudo enviar el email' }, { status: 500 })
    }
}
