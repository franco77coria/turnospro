export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { isBusinessClosed, isTeamMemberAbsent } from '@/lib/availability'
import { applyRateLimit } from '@/lib/rate-limit'
import { AvailabilityCheckSchema, parseBody } from '@/lib/schemas'
import { DEFAULT_DURATION, findConflict, timeToMinutes, toOccupiedRanges } from '@/lib/scheduling'

export async function POST(request) {
    try {
        // Rate limit per IP — availability checks are public but cheap to abuse for enumeration
        const rateLimited = await applyRateLimit(request, { prefix: 'check', limit: 60, windowMs: 60000 })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(AvailabilityCheckSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const {
            business_id, date, time, duration, team_member_id, buffer_time,
            ignore_closures, exclude_appointment_id,
        } = parsed.data

        // Cliente admin a propósito: con la clave anónima, RLS oculta la tabla
        // `appointments` entera y este endpoint respondía "disponible" siempre.
        // La respuesta no expone datos: solo si entra o no, y por qué.
        const supabase = createSupabaseAdmin()

        // El dashboard puede saltear estos chequeos: el dueño agenda sobre un
        // feriado o una licencia a sabiendas, con un aviso en pantalla.
        if (!ignore_closures) {
            const closed = await isBusinessClosed(supabase, business_id, date)
            if (closed) {
                return NextResponse.json({ available: false, reason: 'El negocio está cerrado en esta fecha' })
            }

            if (team_member_id) {
                const absent = await isTeamMemberAbsent(supabase, team_member_id, business_id, date)
                if (absent) {
                    return NextResponse.json({ available: false, reason: 'El profesional no está disponible en esta fecha' })
                }
            }
        }

        const bufferMinutes = buffer_time || 0
        const slotStart = timeToMinutes(time)
        const slotEnd = slotStart + (duration || DEFAULT_DURATION)

        // Traemos toda la agenda del día: hace falta para el chequeo de capacidad.
        const [{ data: appointments, error }, { count: teamCount }] = await Promise.all([
            supabase
                .from('appointments')
                .select('id, time, duration, team_member_id, status')
                .eq('business_id', business_id)
                .eq('date', date)
                .not('status', 'in', '("cancelled","no_show")'),
            supabase
                .from('team_members')
                .select('id', { count: 'exact', head: true })
                .eq('business_id', business_id)
                .eq('active', true),
        ])
        if (error) throw error

        const occupied = toOccupiedRanges(appointments, { excludeId: exclude_appointment_id || null })

        // 1. El profesional pedido ya tiene algo encima.
        if (team_member_id) {
            const own = findConflict(slotStart, slotEnd, occupied, {
                bufferTime: bufferMinutes,
                teamMemberId: team_member_id,
            })
            if (own) {
                return NextResponse.json({
                    available: false,
                    reason: 'Ese profesional ya tiene un turno que se superpone',
                })
            }
        }

        // 2. Capacidad del negocio. Un local sin equipo cargado atiende de a uno,
        //    así que cualquier superposición lo llena. Con 3 profesionales activos
        //    recién el cuarto turno simultáneo choca.
        const capacity = Math.max(1, teamCount || 0)
        const overlapping = occupied.filter(o =>
            slotStart < o.endMin + bufferMinutes && slotEnd > o.startMin - bufferMinutes
        )

        if (overlapping.length >= capacity) {
            return NextResponse.json({
                available: false,
                reason: capacity === 1
                    ? 'Ese horario se superpone con otro turno'
                    : `No queda nadie libre en ese horario (${overlapping.length} de ${capacity} ocupados)`,
            })
        }

        return NextResponse.json({ available: true, reason: null })
    } catch (err) {
        console.error('Availability check error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
