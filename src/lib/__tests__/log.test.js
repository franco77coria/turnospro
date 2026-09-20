import { describe, it, expect } from 'vitest'
import { maskEmail, maskPhone, maskName, redact } from '../log'

describe('maskEmail', () => {
    it('deja ver el dominio pero no la cuenta', () => {
        expect(maskEmail('ana.perez@gmail.com')).toBe('a***@gmail.com')
    })
    it('no explota con valores ausentes', () => {
        expect(maskEmail(null)).toBe('(sin email)')
        expect(maskEmail('')).toBe('(sin email)')
        expect(maskEmail('no-es-un-email')).toBe('(email inválido)')
    })
})

describe('maskPhone', () => {
    it('conserva país y últimos cuatro', () => {
        expect(maskPhone('+5491168727107')).toBe('+54*****7107')
    })
    it('normaliza separadores antes de enmascarar', () => {
        expect(maskPhone('+54 9 11 6872-7107')).toBe('+54*****7107')
    })
    it('no filtra números cortos', () => {
        expect(maskPhone('123')).toBe('***')
        expect(maskPhone(null)).toBe('(sin teléfono)')
    })
})

describe('maskName', () => {
    it('no escribe el nombre', () => {
        const salida = maskName('Ana Pérez')
        expect(salida).not.toContain('Ana')
        expect(salida).not.toContain('Pérez')
    })
})

describe('redact', () => {
    it('enmascara las claves sensibles de un objeto', () => {
        const out = redact({ name: 'Ana Pérez', email: 'ana@gmail.com', phone: '+5491168727107' })
        expect(out.email).toBe('a***@gmail.com')
        expect(out.phone).toBe('+54*****7107')
        expect(JSON.stringify(out)).not.toContain('Pérez')
    })

    it('deja pasar lo que no es sensible', () => {
        const out = redact({ id: 'abc-123', status: 'pending', duration: 30 })
        expect(out).toEqual({ id: 'abc-123', status: 'pending', duration: 30 })
    })

    it('alcanza objetos anidados', () => {
        const out = redact({ cliente: { email: 'ana@gmail.com' }, id: 'x' })
        expect(out.cliente.email).toBe('a***@gmail.com')
    })

    it('redacta tokens y secretos sin intentar interpretarlos', () => {
        const out = redact({ token: 'abc123', secret: 'shhh', authorization: 'Bearer x' })
        expect(out.token).toBe('[redactado]')
        expect(out.secret).toBe('[redactado]')
        expect(out.authorization).toBe('[redactado]')
    })

    it('trunca strings largos para no llenar los logs', () => {
        expect(redact({ notes: 'x'.repeat(500) }).notes.length).toBeLessThan(220)
    })

    it('no entra en bucle con estructuras profundas', () => {
        const hondo = { a: { b: { c: { d: { e: 'fondo' } } } } }
        expect(() => redact(hondo)).not.toThrow()
    })
})
