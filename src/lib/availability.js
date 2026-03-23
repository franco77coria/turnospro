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
        .gte('date', new Date().toISOString().split('T')[0])

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
        .gte('end_date', new Date().toISOString().split('T')[0])

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
    const slotEnd = slotStart + (duration || 30)

    const conflict = occupied.find(o => slotStart < o.endMin && slotEnd > o.startMin)

    return {
        available: !conflict,
        conflict: conflict || null,
    }
}
