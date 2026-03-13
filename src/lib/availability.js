// Availability checking utilities for appointment conflict validation

/**
 * Convert "HH:MM" string to total minutes since midnight
 */
function timeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
}

/**
 * Convert total minutes to "HH:MM" string
 */
function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Get occupied time ranges for a given business, date, and optionally a specific team member.
 * Returns array of { start, end, startMin, endMin, team_member_id }
 */
export async function getOccupiedSlots(supabase, businessId, date, teamMemberId = null) {
    let query = supabase
        .from('appointments')
        .select('time, duration, team_member_id')
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

    return (data || []).map(apt => {
        const startMin = timeToMinutes(apt.time)
        const endMin = startMin + (apt.duration || 30)
        return {
            start: apt.time,
            end: minutesToTime(endMin),
            startMin,
            endMin,
            team_member_id: apt.team_member_id,
        }
    })
}

/**
 * Filter available slots removing those that would conflict with existing appointments.
 * A slot conflicts if the new service [slotStart, slotStart + duration) overlaps any occupied range.
 */
export function filterAvailableSlots(allSlots, occupiedSlots, serviceDuration, teamMemberId = null) {
    return allSlots.filter(slot => {
        const slotStart = timeToMinutes(slot)
        const slotEnd = slotStart + (serviceDuration || 30)

        // Check against occupied slots (filter by team member if specified)
        const relevantOccupied = teamMemberId
            ? occupiedSlots.filter(o => o.team_member_id === teamMemberId)
            : occupiedSlots

        return !relevantOccupied.some(occupied =>
            slotStart < occupied.endMin && slotEnd > occupied.startMin
        )
    })
}

/**
 * Check if a specific slot is available (server-side validation).
 * Returns { available: boolean, conflict?: object }
 */
export async function checkSlotAvailability(supabase, businessId, date, time, duration, teamMemberId = null) {
    const occupied = await getOccupiedSlots(supabase, businessId, date, teamMemberId)

    const slotStart = timeToMinutes(time)
    const slotEnd = slotStart + (duration || 30)

    const conflict = occupied.find(o => slotStart < o.endMin && slotEnd > o.startMin)

    return {
        available: !conflict,
        conflict: conflict || null,
    }
}
