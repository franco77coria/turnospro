/**
 * Derivaciones para la ficha pública del negocio.
 *
 * La ficha tiene que verse bien el día uno, con un negocio que solo cargó su
 * nombre y dos servicios. Todo lo de acá sale de datos que SIEMPRE existen —
 * horario, agenda, fecha de alta — en vez de depender de fotos y reseñas que
 * un negocio nuevo no tiene.
 */

import {
    DEFAULT_DURATION,
    generateAvailableSlots,
    minutesToTime,
    resolveScheduleSettings,
    timeToMinutes,
    toOccupiedRanges,
} from './scheduling'
import { nowInTimezone } from './timezone'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// El orden de lectura de una semana en español arranca en lunes.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * ¿El dueño configuró de verdad su horario, o estamos por mostrar el default?
 *
 * Importa: la ficha estaba publicando "09:00–20:00, lunes a sábado" como un
 * hecho para negocios que nunca tocaron Ajustes. El cliente va y encuentra
 * cerrado. Sin configurar no se muestra ningún horario.
 */
export function hasConfiguredHours(settings) {
    return Boolean(settings?.work_hours?.start && settings?.work_hours?.end)
}

/**
 * Agrupa días consecutivos con el mismo horario.
 * Siete filas repitiendo "10:00 – 20:45" pasan a ser una.
 */
export function collapseWeeklyHours(settings) {
    if (!hasConfiguredHours(settings)) return []
    const { workDays, startMin, endMin } = resolveScheduleSettings(settings)
    const hours = `${minutesToTime(startMin)} – ${minutesToTime(endMin)}`

    const rows = []
    for (const day of WEEK_ORDER) {
        const open = workDays.includes(day)
        const last = rows[rows.length - 1]
        // Se extiende el tramo anterior solo si comparte estado de apertura.
        if (last && last.open === open) {
            last.days.push(day)
        } else {
            rows.push({ open, days: [day] })
        }
    }

    return rows.map(row => {
        const first = DAY_NAMES[row.days[0]]
        const last = DAY_NAMES[row.days[row.days.length - 1]]
        return {
            label: row.days.length === 1 ? first
                : row.days.length === 2 ? `${first} y ${last}`
                : `${first} a ${last}`,
            hours: row.open ? hours : null,
        }
    })
}

/**
 * Estado ahora mismo, en hora de Argentina.
 * @returns {{ open: boolean, label: string } | null} null si no hay horario configurado
 */
export function resolveOpenStatus(settings, now = nowInTimezone()) {
    if (!hasConfiguredHours(settings)) return null

    const { workDays, startMin, endMin } = resolveScheduleSettings(settings)
    const today = now.getDay()
    const currentMin = now.getHours() * 60 + now.getMinutes()
    const worksToday = workDays.includes(today)

    if (worksToday && currentMin >= startMin && currentMin < endMin) {
        const left = endMin - currentMin
        return {
            open: true,
            label: left <= 60 ? `Abierto · cierra en ${left} min` : `Abierto · cierra ${minutesToTime(endMin)}`,
        }
    }

    if (worksToday && currentMin < startMin) {
        return { open: false, label: `Abre hoy a las ${minutesToTime(startMin)}` }
    }

    // Próximo día de atención, mirando hasta una semana adelante.
    for (let i = 1; i <= 7; i++) {
        const day = (today + i) % 7
        if (!workDays.includes(day)) continue
        const when = i === 1 ? 'mañana' : DAY_NAMES[day].toLowerCase()
        return { open: false, label: `Abre ${when} a las ${minutesToTime(startMin)}` }
    }

    return { open: false, label: 'Cerrado' }
}

/**
 * Disponibilidad real de hoy: la prueba que un negocio nuevo sí tiene.
 * Ningún perfil estático de la competencia puede mostrar esto.
 *
 * @returns {{ freeToday: number, nextSlot: string|null } | null}
 */
export function resolveTodayAvailability({ settings, occupied, duration, now = nowInTimezone() }) {
    if (!hasConfiguredHours(settings)) return null
    const { workDays } = resolveScheduleSettings(settings)
    if (!workDays.includes(now.getDay())) return null

    const slots = generateAvailableSlots({
        settings,
        duration: duration || DEFAULT_DURATION,
        occupied,
        date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        now,
        enforceMinAdvance: true,
    })

    return { freeToday: slots.length, nextSlot: slots[0] || null }
}

/**
 * Link de WhatsApp. En este mercado la reserva se conversa por ahí, y el único
 * contacto que tenía la ficha era un `tel:`, que nadie usa.
 *
 * Los teléfonos se guardan sin código de país (10 dígitos). Todo el producto
 * asume Argentina — `lib/timezone.js` fija America/Argentina/Buenos_Aires — así
 * que normalizar a 54 9 es coherente con esa verdad. Si el número ya trae
 * código de país se respeta tal cual.
 *
 * @returns {string|null} null si el número no alcanza para armar un link
 */
export function buildWhatsAppLink(phone, message = '') {
    if (!phone) return null
    const raw = String(phone).trim()
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 8) return null

    let international
    if (raw.startsWith('+')) {
        international = digits
    } else if (digits.startsWith('54')) {
        // 54 sin el 9 de celular no sirve para WhatsApp.
        international = digits.startsWith('549') ? digits : `549${digits.slice(2)}`
    } else if (digits.length === 10) {
        international = `549${digits}`
    } else {
        return null
    }

    const query = message ? `?text=${encodeURIComponent(message)}` : ''
    return `https://wa.me/${international}${query}`
}

/** openingHoursSpecification para el schema. Google no podía ver el horario. */
export function buildOpeningHoursSpecification(settings) {
    if (!hasConfiguredHours(settings)) return null
    const { workDays, startMin, endMin } = resolveScheduleSettings(settings)
    const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const open = workDays.filter(d => SCHEMA_DAYS[d])
    if (open.length === 0) return null

    return [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: open.map(d => SCHEMA_DAYS[d]),
        opens: minutesToTime(startMin),
        closes: minutesToTime(endMin),
    }]
}

/**
 * Consulta de mapa a partir de la dirección que escribió el dueño.
 *
 * El campo es texto libre y casi nadie pone la ciudad: "coronel superi 626"
 * puede caer en cualquier localidad con una calle de ese nombre. Se le agrega
 * el país, que es verdad para todo el producto, salvo que ya venga puesto.
 */
export function buildMapQuery(address) {
    const value = String(address || '').trim()
    if (!value) return null
    const yaTienePais = /argentin|,\s*ar\s*$/i.test(value)
    return yaTienePais ? value : `${value}, Argentina`
}

/** "Reservando online desde agosto 2026" — antigüedad, no promesas. */
export function resolveTenure(createdAt) {
    if (!createdAt) return null
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return null
    const months = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)
    // Menos de un mes no dice nada bueno de un negocio nuevo: se omite.
    if (months < 1) return null
    return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export { timeToMinutes, toOccupiedRanges }
