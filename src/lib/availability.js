// Availability checking utilities for appointment conflict validation
// Las primitivas de tiempo viven en scheduling.js, compartidas con el cliente.

import {
    DEFAULT_DURATION,
    findConflict,
    minutesToTime,
    timeToMinutes,
    todayLocal,
    toOccupiedRanges,
} from './scheduling'

/**
 * Get occupied time ranges for a given business, date, and optionally a specific team member.
 * Returns array of { start, end, startMin, endMin, team_member_id }
 */
export async function getOccupiedSlots(supabase, businessId, date, teamMemberId = null) {
    let query = supabase
        .from('appointments')
        .select('id, time, duration, team_member_id, status')
        .eq('business_id', businessId)
        .eq('date', date)
        .not('status', 'in', '("cancelled","no_show")')

    if (teamMemberId) {
        query = query.eq('team_member_id', teamMemberId)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching occupied slots:', error)
        return []
    }

    return toOccupiedRanges(data).map(range => ({
        ...range,
        start: minutesToTime(range.startMin),
        end: minutesToTime(range.endMin),
    }))
}

/**
 * Filter available slots removing those that would conflict with existing appointments.
 * A slot conflicts if the new service [slotStart, slotStart + duration) overlaps any occupied range.
 */
export function filterAvailableSlots(allSlots, occupiedSlots, serviceDuration, teamMemberId = null) {
    return allSlots.filter(slot => {
        const slotStart = timeToMinutes(slot)
        const slotEnd = slotStart + (serviceDuration || DEFAULT_DURATION)
        return !findConflict(slotStart, slotEnd, occupiedSlots, { teamMemberId })
    })
}

/**
 * Check if a business is closed on a specific date.
 * Checks both business_closures table and settings.closed_dates for backwards compatibility.
 */
export async function isBusinessClosed(supabase, businessId, date) {
    // Check business_closures table first
    const { data, error } = await supabase
        .from('business_closures')
        .select('id')
        .eq('business_id', businessId)
        .eq('date', date)
        .limit(1)

    if (!error && data?.length > 0) return true

    // Fallback: check settings.closed_dates JSONB
    const { data: biz } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .single()

    const closedDates = (biz?.settings?.closed_dates || []).map(cd => cd.date)
    return closedDates.includes(date)
}

/**
 * Check if a team member is absent on a specific date.
 */
export async function isTeamMemberAbsent(supabase, teamMemberId, businessId, date) {
    if (!teamMemberId) return false

    const { data, error } = await supabase
        .from('team_absences')
        .select('id')
        .eq('team_member_id', teamMemberId)
        .eq('business_id', businessId)
        .lte('start_date', date)
        .gte('end_date', date)
        .limit(1)

    if (error) {
        console.error('Error checking team absence:', error)
        return false
    }

    return data?.length > 0
}

/**
 * Get all business closure dates within a date range.
 */
export async function getBusinessClosures(supabase, businessId) {
    const { data, error } = await supabase
        .from('business_closures')
        .select('date, reason')
        .eq('business_id', businessId)
        .gte('date', todayLocal())

    if (error) {
        console.error('Error fetching closures:', error)
        return []
    }
    return data || []
}

/**
 * Get all team absences for a business (future dates).
 */
export async function getTeamAbsences(supabase, businessId, teamMemberId = null) {
    let query = supabase
        .from('team_absences')
        .select('id, team_member_id, start_date, end_date, reason')
        .eq('business_id', businessId)
        .gte('end_date', todayLocal())

    if (teamMemberId) {
        query = query.eq('team_member_id', teamMemberId)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching absences:', error)
        return []
    }
    return data || []
}

/**
 * Check if a specific slot is available (server-side validation).
 * Returns { available: boolean, conflict?: object }
 */
export async function checkSlotAvailability(supabase, businessId, date, time, duration, teamMemberId = null) {
    const occupied = await getOccupiedSlots(supabase, businessId, date, teamMemberId)

    const slotStart = timeToMinutes(time)
    const slotEnd = slotStart + (duration || DEFAULT_DURATION)

    const conflict = findConflict(slotStart, slotEnd, occupied)

    return {
        available: !conflict,
        conflict: conflict || null,
    }
}

/**
 * Chequeo de superposición para mover/editar un turno existente.
 *
 * Antes reprogramar comparaba con `time = nuevaHora` exacto: un turno de 45 min
 * a las 10:00 no impedía mover otro a las 10:15. Acá se compara por rango real
 * y se respeta la capacidad del negocio.
 *
 * @returns {Promise<{ available: boolean, reason: string|null }>}
 */
export async function checkRescheduleAvailability(supabase, {
    businessId, date, time, duration, teamMemberId = null,
    excludeId = null, bufferTime = 0,
}) {
    const [{ data: appointments, error }, { count: teamCount }] = await Promise.all([
        supabase
            .from('appointments')
            .select('id, time, duration, team_member_id, status')
            .eq('business_id', businessId)
            .eq('date', date)
            .not('status', 'in', '("cancelled","no_show")'),
        supabase
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('active', true),
    ])

    if (error) {
        console.error('Error checking reschedule availability:', error)
        return { available: false, reason: 'No se pudo verificar la disponibilidad' }
    }

    const occupied = toOccupiedRanges(appointments, { excludeId })
    const slotStart = timeToMinutes(time)
    const slotEnd = slotStart + (duration || DEFAULT_DURATION)

    if (teamMemberId) {
        const own = findConflict(slotStart, slotEnd, occupied, { bufferTime, teamMemberId })
        if (own) {
            return { available: false, reason: 'Ese profesional ya tiene un turno que se superpone' }
        }
    }

    const capacity = Math.max(1, teamCount || 0)
    const overlapping = occupied.filter(o =>
        slotStart < o.endMin + bufferTime && slotEnd > o.startMin - bufferTime
    )

    if (overlapping.length >= capacity) {
        return {
            available: false,
            reason: capacity === 1
                ? 'Ese horario se superpone con otro turno'
                : `No queda nadie libre en ese horario (${overlapping.length} de ${capacity} ocupados)`,
        }
    }

    return { available: true, reason: null }
}
