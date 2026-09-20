import { describe, it, expect } from 'vitest'
import { formatVisitsLabel, isRecurringClient } from '../client-visits'

describe('client-visits utilities', () => {
    describe('formatVisitsLabel', () => {
        it('retorna null para 0, null, undefined o valores negativos', () => {
            expect(formatVisitsLabel(0)).toBeNull()
            expect(formatVisitsLabel(null)).toBeNull()
            expect(formatVisitsLabel(undefined)).toBeNull()
            expect(formatVisitsLabel(-2)).toBeNull()
            expect(formatVisitsLabel('0')).toBeNull()
        })

        it('formatea correctamente 1 visita en singular', () => {
            expect(formatVisitsLabel(1)).toBe('1 visita')
            expect(formatVisitsLabel('1')).toBe('1 visita')
        })

        it('formatea correctamente múltiples visitas en plural', () => {
            expect(formatVisitsLabel(2)).toBe('2 visitas')
            expect(formatVisitsLabel(5)).toBe('5 visitas')
            expect(formatVisitsLabel('12')).toBe('12 visitas')
        })
    })

    describe('isRecurringClient', () => {
        it('retorna false para 0 o 1 visita', () => {
            expect(isRecurringClient(0)).toBe(false)
            expect(isRecurringClient(1)).toBe(false)
            expect(isRecurringClient(null)).toBe(false)
        })

        it('retorna true para 2 o más visitas', () => {
            expect(isRecurringClient(2)).toBe(true)
            expect(isRecurringClient(7)).toBe(true)
        })
    })
})
