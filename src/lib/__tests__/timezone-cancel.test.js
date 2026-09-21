import { describe, expect, it } from 'vitest'
import { hoursUntilSlot } from '../timezone'

describe('política de cancelación por hora local del negocio', () => {
    it('respeta el día y el corte cerca de medianoche', () => {
        const now = new Date(2026, 8, 20, 23, 30)
        expect(hoursUntilSlot('2026-09-21', '01:30', undefined, now)).toBe(2)
        expect(hoursUntilSlot('2026-09-20', '22:00', undefined, now)).toBe(-1.5)
    })
})
