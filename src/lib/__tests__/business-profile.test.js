import { describe, it, expect } from 'vitest'
import {
    buildMapQuery,
    buildOpeningHoursSpecification,
    buildWhatsAppLink,
    collapseWeeklyHours,
    hasConfiguredHours,
    resolveOpenStatus,
    resolveTodayAvailability,
} from '../business-profile.js'
import { toOccupiedRanges } from '../scheduling.js'

const ABIERTO = { work_hours: { start: '10:00', end: '20:00' }, work_days: [1, 2, 3, 4, 5, 6] }

describe('business-profile', () => {
    describe('hasConfiguredHours', () => {
        it('distingue configurado de no configurado', () => {
            expect(hasConfiguredHours(ABIERTO)).toBe(true)
            expect(hasConfiguredHours({})).toBe(false)
            expect(hasConfiguredHours({ work_hours: { start: '10:00' } })).toBe(false)
        })
    })

    describe('collapseWeeklyHours', () => {
        it('colapsa los días con el mismo horario en un solo tramo', () => {
            expect(collapseWeeklyHours(ABIERTO)).toEqual([
                { label: 'Lunes a Sábado', hours: '10:00 – 20:00' },
                { label: 'Domingo', hours: null },
            ])
        })

        it('no junta tramos separados por un día cerrado', () => {
            const rows = collapseWeeklyHours({ ...ABIERTO, work_days: [1, 2, 4, 5] })
            expect(rows.map(r => r.label)).toEqual(['Lunes y Martes', 'Miércoles', 'Jueves y Viernes', 'Sábado y Domingo'])
        })

        it('sin horario configurado no inventa uno', () => {
            expect(collapseWeeklyHours({})).toEqual([])
        })
    })

    describe('resolveOpenStatus', () => {
        // 2026-08-17 es lunes
        const lunes = h => new Date(2026, 7, 17, h, 0, 0)

        it('abierto dentro del horario', () => {
            expect(resolveOpenStatus(ABIERTO, lunes(14))).toEqual({ open: true, label: 'Abierto · cierra 20:00' })
        })

        it('avisa cuando falta menos de una hora para cerrar', () => {
            const s = resolveOpenStatus(ABIERTO, new Date(2026, 7, 17, 19, 30))
            expect(s.label).toBe('Abierto · cierra en 30 min')
        })

        it('antes de abrir, dice a qué hora abre hoy', () => {
            expect(resolveOpenStatus(ABIERTO, lunes(8))).toEqual({ open: false, label: 'Abre hoy a las 10:00' })
        })

        it('después de cerrar, apunta al próximo día de atención', () => {
            expect(resolveOpenStatus(ABIERTO, lunes(22)).label).toBe('Abre mañana a las 10:00')
        })

        it('un domingo cerrado apunta al lunes', () => {
            // 2026-08-16 es domingo
            expect(resolveOpenStatus(ABIERTO, new Date(2026, 7, 16, 12)).label).toBe('Abre mañana a las 10:00')
        })

        it('sin horario configurado no afirma nada', () => {
            expect(resolveOpenStatus({}, lunes(14))).toBeNull()
        })
    })

    describe('resolveTodayAvailability', () => {
        it('cuenta los turnos libres y da el próximo', () => {
            const now = new Date(2026, 7, 17, 10, 0)
            const r = resolveTodayAvailability({
                settings: { ...ABIERTO, slot_duration: 60, min_advance_hours: 0 },
                occupied: toOccupiedRanges([{ id: 'a', time: '11:00', duration: 60, status: 'confirmed' }]),
                duration: 60,
                now,
            })
            // 10:00 a 20:00 son 10 turnos de una hora; uno ocupado deja 9
            expect(r.freeToday).toBe(9)
            expect(r.nextSlot).toBe('10:00')
        })

        it('un día no laborable no reporta disponibilidad', () => {
            expect(resolveTodayAvailability({
                settings: ABIERTO,
                occupied: [],
                duration: 60,
                now: new Date(2026, 7, 16, 12), // domingo
            })).toBeNull()
        })
    })

    describe('buildWhatsAppLink', () => {
        it('normaliza un número argentino de 10 dígitos', () => {
            expect(buildWhatsAppLink('1168727107')).toBe('https://wa.me/5491168727107')
        })

        it('respeta el número que ya trae código de país', () => {
            expect(buildWhatsAppLink('+54 9 11 6872-7107')).toBe('https://wa.me/5491168727107')
        })

        it('agrega el 9 que WhatsApp necesita si falta', () => {
            expect(buildWhatsAppLink('541168727107')).toBe('https://wa.me/5491168727107')
        })

        it('codifica el mensaje', () => {
            // encodeURIComponent deja el "!" tal cual, así que se prueba con
            // espacios y acentos, que son lo que de verdad rompe una URL.
            expect(buildWhatsAppLink('1168727107', 'Hola! ¿Reservás?'))
                .toBe('https://wa.me/5491168727107?text=Hola!%20%C2%BFReserv%C3%A1s%3F')
        })

        it('devuelve null si el número no alcanza', () => {
            expect(buildWhatsAppLink('')).toBeNull()
            expect(buildWhatsAppLink('123')).toBeNull()
            expect(buildWhatsAppLink(null)).toBeNull()
        })
    })

    describe('buildMapQuery', () => {
        it('agrega el país a una dirección suelta', () => {
            expect(buildMapQuery('coronel superi 626')).toBe('coronel superi 626, Argentina')
        })

        it('no lo duplica si ya está', () => {
            expect(buildMapQuery('Coronel Superí 626, CABA, Argentina')).toBe('Coronel Superí 626, CABA, Argentina')
        })

        it('sin dirección no hay mapa', () => {
            expect(buildMapQuery('')).toBeNull()
            expect(buildMapQuery(null)).toBeNull()
        })
    })

    describe('buildOpeningHoursSpecification', () => {
        it('arma el bloque de schema con los días de atención', () => {
            const [spec] = buildOpeningHoursSpecification(ABIERTO)
            expect(spec.dayOfWeek).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
            expect(spec.opens).toBe('10:00')
            expect(spec.closes).toBe('20:00')
        })

        it('sin horario configurado no publica nada', () => {
            expect(buildOpeningHoursSpecification({})).toBeNull()
        })
    })
})
