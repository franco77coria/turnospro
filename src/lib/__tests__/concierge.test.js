import { describe, it, expect } from 'vitest'
import { distanceKm, rankMatches } from '../concierge'

describe('concierge', () => {
    it('calcula kilómetros y no inventa distancia cuando falta ubicación', () => {
        expect(distanceKm(-34.6, -58.4, -34.6, -58.4)).toBe(0)
        expect(distanceKm(-34.6, -58.4, -34.61, -58.4)).toBeCloseTo(1.1, 0)
    })
    it('prioriza zona, día y distancia', () => {
        const matches = [
            { address: 'Palermo', dayOffset: 1, distanceKm: 2, time: '10:00' },
            { address: 'Belgrano', dayOffset: 0, distanceKm: 1, time: '11:00' },
            { address: 'Palermo Soho', dayOffset: 0, distanceKm: 3, time: '09:00' },
        ]
        expect(rankMatches(matches, 'palermo')[0].address).toBe('Palermo Soho')
        expect(rankMatches(matches)[0].address).toBe('Belgrano')
    })
})
