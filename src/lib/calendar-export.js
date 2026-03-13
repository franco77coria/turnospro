// Calendar export utilities — Google Calendar URL and .ics file generation

/**
 * Format date + time to ISO string without separators for Google Calendar
 * Input: date "2026-03-15", time "14:00", duration 30
 * Output: { start: "20260315T140000", end: "20260315T143000" }
 */
function formatCalendarDates(date, time, duration) {
    const [year, month, day] = date.split('-')
    const [hour, min] = time.split(':')
    const start = `${year}${month}${day}T${hour}${min}00`

    const endDate = new Date(`${date}T${time}:00`)
    endDate.setMinutes(endDate.getMinutes() + (duration || 30))

    const ey = endDate.getFullYear()
    const em = String(endDate.getMonth() + 1).padStart(2, '0')
    const ed = String(endDate.getDate()).padStart(2, '0')
    const eh = String(endDate.getHours()).padStart(2, '0')
    const emin = String(endDate.getMinutes()).padStart(2, '0')
    const end = `${ey}${em}${ed}T${eh}${emin}00`

    return { start, end }
}

/**
 * Generate a Google Calendar event URL
 */
export function googleCalendarUrl({ serviceName, date, time, duration, businessName, address }) {
    const { start, end } = formatCalendarDates(date, time, duration)
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `${serviceName} — ${businessName}`,
        dates: `${start}/${end}`,
        details: `Turno de ${serviceName} en ${businessName}`,
        location: address || '',
    })
    return `https://calendar.google.com/calendar/event?${params.toString()}`
}

/**
 * Generate an .ics file content string
 */
export function generateICS({ serviceName, date, time, duration, businessName, address }) {
    const { start, end } = formatCalendarDates(date, time, duration)
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}00`

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GLOWUP//Turnos//ES',
        'BEGIN:VEVENT',
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${serviceName} — ${businessName}`,
        `DESCRIPTION:Turno de ${serviceName} en ${businessName}`,
        address ? `LOCATION:${address}` : '',
        'STATUS:CONFIRMED',
        `UID:${Date.now()}@glowup`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')
}

/**
 * Trigger .ics file download in the browser
 */
export function downloadICS(icsContent, filename = 'turno.ics') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
