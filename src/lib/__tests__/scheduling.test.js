import { describe, it, expect } from 'vitest'
import {
    generateAvailableSlots,
    layoutDayAppointments,
    resolveCalendarRange,
    resolveScheduleSettings,
    toOccupiedRanges,
    findConflict,
    formatDateLocal,
    minutesToTime,
    timeToMinutes,
} from '../scheduling.js'

const OPEN_9_TO_18 = { work_hours: { start: '09:00', end: '18:00' } }

describe('scheduling', () => {
    describe('timeToMinutes / minutesToTime', () => {
        it('acepta HH:MM y HH:MM:SS', () => {
            expect(timeToMinutes('09:45')).toBe(585)
            expect(timeToMinutes('09:45:00')).toBe(585)
            expect(minutesToTime(585)).toBe('09:45')
            expect(minutesToTime(0)).toBe('00:00')
        })
    })

    describe('formatDateLocal', () => {
        it('usa la fecha local, no UTC', () => {
            // 23:30 del 15 en hora local. Con toISOString() en UTC-3 daría el 16.
            const d = new Date(2026, 7, 15, 23, 30, 0)
            expect(formatDateLocal(d)).toBe('2026-08-15')
        })
    })

    describe('resolveScheduleSettings', () => {
        it('slot_duration null o ausente queda en automático', () => {
            expect(resolveScheduleSettings({}).slotInterval).toBeNull()
            expect(resolveScheduleSettings({ slot_duration: null }).slotInterval).toBeNull()
            expect(resolveScheduleSettings({ slot_duration: 0 }).slotInterval).toBeNull()
        })

        it('respeta un intervalo explícito', () => {
            expect(resolveScheduleSettings({ slot_duration: 20 }).slotInterval).toBe(20)
        })

        it('work_days vacío cae al default en vez de dejar el negocio sin días', () => {
            expect(resolveScheduleSettings({ work_days: [] }).workDays).toEqual([1, 2, 3, 4, 5, 6])
        })
    })

    describe('generateAvailableSlots', () => {
        it('un servicio de 45 min avanza de a 45 min', () => {
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '12:00' } },
                duration: 45,
            })
            expect(slots).toEqual(['09:00', '09:45', '10:30', '11:15'])
        })

        it('no ofrece un horario donde el servicio no termina antes de cerrar', () => {
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '10:00' } },
                duration: 45,
            })
            // 09:00 termina 09:45 (entra). 09:45 terminaría 10:30 (no entra).
            expect(slots).toEqual(['09:00'])
        })

        it('el intervalo explícito manda sobre la duración', () => {
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '11:00' }, slot_duration: 30 },
                duration: 45,
            })
            expect(slots).toEqual(['09:00', '09:30', '10:00'])
        })

        it('descarta los horarios que se pisan con un turno existente y habilita el hueco inmediato', () => {
            const occupied = toOccupiedRanges([{ id: 'a', time: '10:00', duration: 45, status: 'confirmed' }])
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '12:00' } },
                duration: 30,
                occupied,
            })
            // Ocupado 10:00-10:45 → 10:00 y 10:30 no van, pero 10:45 (fin del turno) y 11:15 sí están disponibles
            expect(slots).toEqual(['09:00', '09:30', '10:45', '11:00', '11:15', '11:30'])
        })

        it('aplica el buffer a los dos lados del turno existente', () => {
            const occupied = toOccupiedRanges([{ id: 'a', time: '10:00', duration: 30, status: 'confirmed' }])
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '12:00' }, buffer_time: 15 },
                duration: 30,
                occupied,
            })
            // Ocupado real 10:00-10:30; con buffer 15m la zona vedada es 09:45-10:45.
            // 09:15 termina 09:45 (justo antes del buffer). 10:45 arranca justo después del buffer.
            expect(slots).toEqual(['09:00', '09:15', '10:45', '11:00', '11:15', '11:30'])
        })

        it('un turno a las 16:45 permite reservar el siguiente a las 17:30 (caso BARONE)', () => {
            const occupied = toOccupiedRanges([{ id: 'b', time: '16:45', duration: 45, status: 'confirmed' }])
            const slots = generateAvailableSlots({
                settings: { work_hours: { start: '09:00', end: '20:00' } },
                duration: 45,
                occupied,
            })
            // 17:30 arranca justo cuando termina el de 16:45
            expect(slots).toContain('17:30')
            // 16:00 termina justo cuando arranca el de 16:45
            expect(slots).toContain('16:00')
            // 16:30 y 17:15 chocan con 16:45-17:30
            expect(slots).not.toContain('16:30')
            expect(slots).not.toContain('17:15')
        })

        it('ignora los turnos cancelados: el horario vuelve a estar libre', () => {
            const occupied = toOccupiedRanges([
                { id: 'a', time: '10:00', duration: 60, status: 'cancelled' },
                { id: 'b', time: '11:00', duration: 60, status: 'no_show' },
            ])
            expect(occupied).toEqual([])
        })

        it('respeta la antelación mínima solo el mismo día', () => {
            const now = new Date(2026, 7, 15, 10, 0, 0)
            const settings = { ...OPEN_9_TO_18, min_advance_hours: 2, slot_duration: 60 }

            const hoy = generateAvailableSlots({
                settings, duration: 60, date: '2026-08-15', now,
            })
            expect(hoy[0]).toBe('12:00')

            const manana = generateAvailableSlots({
                settings, duration: 60, date: '2026-08-16', now,
            })
            expect(manana[0]).toBe('09:00')
        })

        it('el dashboard puede saltear la antelación mínima para un walk-in', () => {
            const now = new Date(2026, 7, 15, 10, 0, 0)
            const slots = generateAvailableSlots({
                settings: { ...OPEN_9_TO_18, min_advance_hours: 2, slot_duration: 60 },
                duration: 60,
                date: '2026-08-15',
                now,
                enforceMinAdvance: false,
            })
            expect(slots[0]).toBe('10:00')
        })

        it('con profesional elegido, solo choca contra los turnos de ese profesional', () => {
            const occupied = toOccupiedRanges([
                { id: 'a', time: '10:00', duration: 60, team_member_id: 'tm-1', status: 'confirmed' },
            ])
            const paraTm2 = generateAvailableSlots({
                settings: { work_hours: { start: '10:00', end: '11:00' } },
                duration: 60, occupied, teamMemberId: 'tm-2',
            })
            expect(paraTm2).toEqual(['10:00'])

            const paraTm1 = generateAvailableSlots({
                settings: { work_hours: { start: '10:00', end: '11:00' } },
                duration: 60, occupied, teamMemberId: 'tm-1',
            })
            expect(paraTm1).toEqual([])
        })
    })

    describe('findConflict', () => {
        it('turnos que se tocan en el borde no se consideran superpuestos', () => {
            const occupied = toOccupiedRanges([{ id: 'a', time: '10:00', duration: 30, status: 'confirmed' }])
            // 10:30-11:00 arranca justo cuando el otro termina
            expect(findConflict(630, 660, occupied)).toBeNull()
            // 10:29-10:59 sí se pisa por un minuto
            expect(findConflict(629, 659, occupied)).not.toBeNull()
        })
    })

    describe('layoutDayAppointments', () => {
        it('calcula el rango real de cada turno', () => {
            const [apt] = layoutDayAppointments([{ id: 'a', time: '09:00', duration: 45 }])
            expect(apt.startMin).toBe(540)
            expect(apt.endMin).toBe(585)
            expect(apt.columns).toBe(1)
        })

        it('reparte en columnas los turnos que se pisan', () => {
            const laid = layoutDayAppointments([
                { id: 'a', time: '09:00', duration: 60 },
                { id: 'b', time: '09:30', duration: 60 },
            ])
            expect(laid.every(a => a.columns === 2)).toBe(true)
            expect(laid.map(a => a.column).sort()).toEqual([0, 1])
        })

        it('turnos consecutivos que no se pisan comparten columna', () => {
            const laid = layoutDayAppointments([
                { id: 'a', time: '09:00', duration: 45 },
                { id: 'b', time: '09:45', duration: 45 },
            ])
            expect(laid.every(a => a.columns === 1 && a.column === 0)).toBe(true)
        })

        it('un turno sin duración usa 30 min y no rompe el layout', () => {
            const [apt] = layoutDayAppointments([{ id: 'a', time: '09:00' }])
            expect(apt.endMin - apt.startMin).toBe(30)
        })
    })

    describe('resolveCalendarRange', () => {
        it('usa el horario de atención cuando todo entra', () => {
            const r = resolveCalendarRange(OPEN_9_TO_18, [{ time: '10:00', duration: 60 }])
            expect(minutesToTime(r.startMin)).toBe('09:00')
            expect(minutesToTime(r.endMin)).toBe('18:00')
        })

        it('se estira para que un turno fuera de horario no quede invisible', () => {
            const r = resolveCalendarRange(OPEN_9_TO_18, [
                { time: '07:30', duration: 30 },
                { time: '19:30', duration: 60 },
            ])
            expect(minutesToTime(r.startMin)).toBe('07:00')
            expect(minutesToTime(r.endMin)).toBe('21:00')
        })
    })
})
