/**
 * Timezone utilities for converting between UTC and business-local time.
 * Default timezone: America/Argentina/Buenos_Aires (UTC-3)
 */

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires'

/**
 * Get current time in a specific timezone
 * @param {string} tz - IANA timezone string
 * @returns {Date} Date object adjusted to the timezone (still UTC internally but formatted for tz)
 */
export function nowInTimezone(tz = DEFAULT_TZ) {
    const now = new Date()
    const formatted = now.toLocaleString('en-US', { timeZone: tz })
    return new Date(formatted)
}

/**
 * Convert a UTC date to a specific timezone
 * @param {Date|string} utcDate
 * @param {string} tz
 * @returns {Date}
 */
export function utcToLocal(utcDate, tz = DEFAULT_TZ) {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate
    const formatted = date.toLocaleString('en-US', { timeZone: tz })
    return new Date(formatted)
}

/**
 * Format a date for display in a timezone
 * @param {Date|string} date
 * @param {string} tz
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatInTimezone(date, tz = DEFAULT_TZ, options = {}) {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('es-AR', { timeZone: tz, ...options })
}

/**
 * Check if a given time (HH:MM) on a given date is in the past for a timezone
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @param {string} tz
 * @returns {boolean}
 */
export function isTimePast(dateStr, timeStr, tz = DEFAULT_TZ) {
    const now = nowInTimezone(tz)
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hours, minutes] = timeStr.split(':').map(Number)
    const target = new Date(year, month - 1, day, hours, minutes)
    return target < now
}

/**
 * Get appointments that are within N hours from now in a timezone
 * @param {Array} appointments - Array of { date: 'YYYY-MM-DD', time: 'HH:MM', ... }
 * @param {number} hoursAhead
 * @param {string} tz
 * @returns {Array}
 */
export function getUpcomingInWindow(appointments, hoursAhead = 2, tz = DEFAULT_TZ) {
    const now = nowInTimezone(tz)
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

    return appointments.filter(apt => {
        const [year, month, day] = apt.date.split('-').map(Number)
        const [hours, minutes] = (apt.time || '00:00').split(':').map(Number)
        const aptTime = new Date(year, month - 1, day, hours, minutes)
        return aptTime >= now && aptTime <= windowEnd
    })
}
