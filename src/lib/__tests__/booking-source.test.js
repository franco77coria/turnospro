import { describe, expect, it } from 'vitest'
import { normalizeBookingSource, withBookingSource } from '../booking-source'

describe('booking source', () => {
    it('acepta solo orígenes conocidos', () => {
        expect(normalizeBookingSource('flyer')).toBe('flyer')
        expect(normalizeBookingSource('inventado')).toBe('direct')
    })

    it('conserva parámetros al agregar atribución y servicio', () => {
        expect(withBookingSource('/book/123?promo=uno', 'map', { service: 'svc-1' }))
            .toBe('/book/123?promo=uno&source=map&service=svc-1')
    })
})
