import { describe, it, expect } from 'vitest'
import { FeedbackSchema, parseBody } from '../schemas'

const valido = { mensaje: 'El calendario se me hace difícil de leer en el celular.' }

describe('FeedbackSchema', () => {
    it('acepta lo mínimo: solo el mensaje', () => {
        const r = parseBody(FeedbackSchema, valido)
        expect(r.ok).toBe(true)
        // Los defaults tienen que estar, o el insert guarda nulls.
        expect(r.data.tipo).toBe('otro')
        expect(r.data.rol).toBe('cliente')
        expect(r.data.contactable).toBe(false)
    })

    it('el puntaje es opcional, porque obligarlo baja las respuestas', () => {
        expect(parseBody(FeedbackSchema, valido).ok).toBe(true)
        expect(parseBody(FeedbackSchema, { ...valido, puntaje: 4 }).ok).toBe(true)
        expect(parseBody(FeedbackSchema, { ...valido, puntaje: null }).ok).toBe(true)
    })

    it('rechaza puntajes fuera de 1 a 5', () => {
        for (const p of [0, 6, -1, 2.5]) {
            expect(parseBody(FeedbackSchema, { ...valido, puntaje: p }).ok, `puntaje ${p}`).toBe(false)
        }
    })

    it('rechaza un mensaje vacío o de relleno', () => {
        for (const m of ['', '   ', 'ab']) {
            expect(parseBody(FeedbackSchema, { mensaje: m }).ok, JSON.stringify(m)).toBe(false)
        }
    })

    it('recorta los espacios del mensaje', () => {
        const r = parseBody(FeedbackSchema, { mensaje: '   me gusta mucho   ' })
        expect(r.data.mensaje).toBe('me gusta mucho')
    })

    it('pone un techo al mensaje para que no llene la tabla', () => {
        expect(parseBody(FeedbackSchema, { mensaje: 'x'.repeat(2001) }).ok).toBe(false)
        expect(parseBody(FeedbackSchema, { mensaje: 'x'.repeat(2000) }).ok).toBe(true)
    })

    it('solo acepta los tipos y roles conocidos', () => {
        expect(parseBody(FeedbackSchema, { ...valido, tipo: 'queja' }).ok).toBe(false)
        expect(parseBody(FeedbackSchema, { ...valido, rol: 'admin' }).ok).toBe(false)
        expect(parseBody(FeedbackSchema, { ...valido, tipo: 'falla', rol: 'negocio' }).ok).toBe(true)
    })

    it('exige que business_id sea un uuid si viene', () => {
        expect(parseBody(FeedbackSchema, { ...valido, business_id: 'no-uuid' }).ok).toBe(false)
        expect(parseBody(FeedbackSchema, { ...valido, business_id: null }).ok).toBe(true)
    })

    it('no filtra los errores crudos de Zod al cliente', () => {
        const r = parseBody(FeedbackSchema, { mensaje: '' })
        expect(r.error).toBe('Datos inválidos')
        expect(JSON.stringify(r)).not.toMatch(/ZodError|invalid_type/)
    })
})
