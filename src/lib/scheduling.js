/**
 * Núcleo de agenda compartido entre la reserva pública y el dashboard.
 *
 * Toda pantalla que genere horarios, detecte superposiciones o dibuje el
 * calendario tiene que pasar por acá. Antes cada una tenía su propia versión
 * y terminaban ofreciendo horarios distintos para el mismo servicio.
 */

export const DEFAULT_DURATION = 30

/** "HH:MM" o "HH:MM:SS" -> minutos desde medianoche */
export function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [h, m] = String(timeStr).split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
}

/** minutos desde medianoche -> "HH:MM" */
export function minutesToTime(minutes) {
    const total = Math.max(0, Math.round(minutes))
    const h = Math.floor(total / 60)
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Fecha local (no UTC) en formato YYYY-MM-DD. `toISOString()` corre el día en UTC-3. */
export function formatDateLocal(date) {
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function todayLocal() {
    return formatDateLocal(new Date())
}

/**
 * "2026-08-16" -> "domingo, 16 de agosto".
 * `new Date('2026-08-16')` se interpreta como medianoche UTC, así que en un
 * runtime al oeste de Greenwich la fecha mostrada se corría un día.
 */
export function formatDateEs(dateStr, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
    if (!dateStr) return ''
    const [y, m, d] = String(dateStr).split('-').map(Number)
    if (!y || !m || !d) return String(dateStr)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', options)
}

/** Dos rangos [start, end) se pisan */
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart
}

/**
 * Lee settings.* del negocio aplicando los mismos defaults en todas las pantallas.
 * `slotInterval` en null significa "automático": el paso lo define la duración
 * del servicio, así un servicio de 45 min arranca cada 45 min.
 */
export function resolveScheduleSettings(settings = {}, date = null) {
    const s = settings || {}
    const rawInterval = parseInt(s.slot_duration, 10)
    let startStr = s.work_hours?.start || '09:00'
    let endStr = s.work_hours?.end || '20:00'

    if (date !== null && date !== undefined && s.work_hours_by_day) {
        let dayNum = null
        if (typeof date === 'number') {
            dayNum = date
        } else if (typeof date === 'string') {
            const [y, m, d] = date.split('-').map(Number)
            if (y && m && d) {
                dayNum = new Date(y, m - 1, d).getDay()
            }
        } else if (date instanceof Date) {
            dayNum = date.getDay()
        }

        if (dayNum !== null && s.work_hours_by_day[dayNum]?.start && s.work_hours_by_day[dayNum]?.end) {
            startStr = s.work_hours_by_day[dayNum].start
            endStr = s.work_hours_by_day[dayNum].end
        }
    }

    return {
        startMin: timeToMinutes(startStr),
        endMin: timeToMinutes(endStr),
        workDays: Array.isArray(s.work_days) && s.work_days.length > 0 ? s.work_days : [1, 2, 3, 4, 5, 6],
        slotInterval: Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : null,
        bufferTime: Math.max(0, parseInt(s.buffer_time, 10) || 0),
        minAdvanceHours: Math.max(0, parseInt(s.min_advance_hours, 10) || 0),
        maxAdvanceDays: Math.max(0, parseInt(s.max_advance_days, 10) || 30),
    }
}

/**
 * Convierte filas de `appointments` en rangos ocupados en minutos.
 * Ignora cancelados y ausentes, y descarta el turno `excludeId` (para editar).
 */
export function toOccupiedRanges(appointments = [], { excludeId = null } = {}) {
    return (appointments || [])
        .filter(apt => apt && apt.time)
        .filter(apt => !['cancelled', 'no_show'].includes(apt.status))
        .filter(apt => !excludeId || apt.id !== excludeId)
        .map(apt => {
            const startMin = timeToMinutes(apt.time)
            return {
                id: apt.id,
                startMin,
                endMin: startMin + (apt.duration || DEFAULT_DURATION),
                team_member_id: apt.team_member_id ?? null,
            }
        })
}

/**
 * Un rango [startMin, endMin) choca con algún turno ocupado.
 * El buffer se aplica alrededor del turno existente, en ambos lados.
 */
export function findConflict(startMin, endMin, occupied = [], { bufferTime = 0, teamMemberId = null } = {}) {
    const relevant = teamMemberId
        ? occupied.filter(o => o.team_member_id === teamMemberId)
        : occupied
    return relevant.find(o =>
        rangesOverlap(startMin, endMin, o.startMin - bufferTime, o.endMin + bufferTime)
    ) || null
}

/**
 * Genera los horarios disponibles de un día. Única implementación para la
 * reserva pública y el wizard del dashboard.
 *
 * @returns {string[]} horarios "HH:MM" donde el servicio entra completo
 */
export function generateAvailableSlots({
    settings,
    duration = DEFAULT_DURATION,
    occupied = [],
    date = null,
    teamMemberId = null,
    enforceMinAdvance = true,
    now = new Date(),
    includeOccupied = false,
}) {
    const cfg = resolveScheduleSettings(settings, date)
    const serviceDuration = duration > 0 ? duration : DEFAULT_DURATION
    // Paso automático: el turno siguiente arranca justo cuando termina el anterior (lineal y contiguo).
    const step = cfg.slotInterval || serviceDuration

    const isToday = date ? date === formatDateLocal(now) : false
    const minStartToday = isToday
        ? now.getHours() * 60 + now.getMinutes() + (enforceMinAdvance ? cfg.minAdvanceHours * 60 : 0)
        : -Infinity

    const candidateSlots = []

    // 1. Grilla base limpia y lineal desde el horario de apertura
    for (let m = cfg.startMin; m + serviceDuration <= cfg.endMin; m += step) {
        candidateSlots.push(m)
    }

    if (includeOccupied) {
        return candidateSlots
            .filter(startMin => startMin >= cfg.startMin)
            .filter(startMin => startMin + serviceDuration <= cfg.endMin)
            .sort((a, b) => a - b)
            .map(startMin => {
                const isPast = startMin < minStartToday
                const hasConflict = !!findConflict(startMin, startMin + serviceDuration, occupied, {
                    bufferTime: cfg.bufferTime,
                    teamMemberId,
                })
                return {
                    time: minutesToTime(startMin),
                    available: !isPast && !hasConflict,
                    reason: isPast ? 'past' : (hasConflict ? 'occupied' : null),
                }
            })
    }

    return candidateSlots
        .filter(startMin => startMin >= cfg.startMin)
        .filter(startMin => startMin + serviceDuration <= cfg.endMin)
        .filter(startMin => startMin >= minStartToday)
        .filter(startMin => !findConflict(startMin, startMin + serviceDuration, occupied, {
            bufferTime: cfg.bufferTime,
            teamMemberId,
        }))
        .sort((a, b) => a - b)
        .map(minutesToTime)
}

/** El negocio atiende ese día de la semana */
export function isWorkDay(settings, date) {
    const cfg = resolveScheduleSettings(settings)
    const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
    return cfg.workDays.includes(d.getDay())
}

/**
 * Posiciona los turnos de un día para dibujarlos a escala.
 * Los que se pisan se reparten el ancho en columnas.
 *
 * @returns {Array} turnos con { startMin, endMin, column, columns }
 */
export function layoutDayAppointments(appointments = []) {
    const items = (appointments || [])
        .filter(apt => apt && apt.time)
        .map(apt => {
            const startMin = timeToMinutes(apt.time)
            return {
                ...apt,
                startMin,
                endMin: startMin + (apt.duration || DEFAULT_DURATION),
            }
        })
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

    // Un cluster es un grupo de turnos encadenados por superposición.
    const clusters = []
    let current = []
    let clusterEnd = -Infinity

    for (const item of items) {
        if (current.length > 0 && item.startMin >= clusterEnd) {
            clusters.push(current)
            current = []
            clusterEnd = -Infinity
        }
        current.push(item)
        clusterEnd = Math.max(clusterEnd, item.endMin)
    }
    if (current.length > 0) clusters.push(current)

    const result = []
    for (const cluster of clusters) {
        // Cada columna guarda el fin del último turno que metió.
        const columnEnds = []
        for (const item of cluster) {
            let col = columnEnds.findIndex(end => end <= item.startMin)
            if (col === -1) {
                col = columnEnds.length
                columnEnds.push(item.endMin)
            } else {
                columnEnds[col] = item.endMin
            }
            item.column = col
        }
        for (const item of cluster) {
            item.columns = columnEnds.length
            result.push(item)
        }
    }
    return result
}

/**
 * Rango horario que tiene que mostrar el calendario: el horario de atención,
 * extendido para que ningún turno fuera de horario quede invisible.
 */
export function resolveCalendarRange(settings, appointments = []) {
    const cfg = resolveScheduleSettings(settings)
    let startMin = cfg.startMin
    let endMin = cfg.endMin

    const s = settings || {}
    if (s.work_hours_by_day && typeof s.work_hours_by_day === 'object') {
        const days = Array.isArray(s.work_days) && s.work_days.length > 0 ? s.work_days : [1, 2, 3, 4, 5, 6]
        for (const d of days) {
            const dHours = s.work_hours_by_day[d]
            if (dHours?.start) {
                const sm = timeToMinutes(dHours.start)
                if (sm < startMin) startMin = sm
            }
            if (dHours?.end) {
                const em = timeToMinutes(dHours.end)
                if (em > endMin) endMin = em
            }
        }
    }

    for (const apt of appointments) {
        if (!apt?.time) continue
        const aptStart = timeToMinutes(apt.time)
        const aptEnd = aptStart + (apt.duration || DEFAULT_DURATION)
        if (aptStart < startMin) startMin = aptStart
        if (aptEnd > endMin) endMin = aptEnd
    }

    // Redondeo a horas completas para que las líneas guía caigan en punto.
    startMin = Math.floor(startMin / 60) * 60
    endMin = Math.ceil(endMin / 60) * 60
    if (endMin <= startMin) endMin = startMin + 60

    return { startMin, endMin }
}
