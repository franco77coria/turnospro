import { describe, it, expect } from 'vitest'
import { mensajeParaCliente, personalizarMensajeCliente, primerNombre, TIPOS_DE_MENSAJE } from '../client-contact'
import { buildWhatsAppLink } from '../business-profile'

const turno = {
    clientName: 'Ana Pérez García',
    businessName: 'Barone Barber',
    serviceName: 'Corte y barba',
    date: '2026-10-15',
    time: '14:30:00',
}

describe('primerNombre', () => {
    it('toma solo el primer nombre', () => {
        expect(primerNombre('Ana Pérez García')).toBe('Ana')
    })
    it('tolera espacios de más', () => {
        expect(primerNombre('   Juan   Carlos  ')).toBe('Juan')
    })
    it('devuelve vacío si no hay nombre', () => {
        expect(primerNombre(null)).toBe('')
        expect(primerNombre('')).toBe('')
    })
})

describe('mensajeParaCliente', () => {
    it('saluda por el primer nombre y nombra al negocio', () => {
        const m = mensajeParaCliente('confirmar', turno)
        expect(m).toContain('Hola Ana!')
        expect(m).toContain('Barone Barber')
    })

    it('incluye servicio, fecha en palabras y hora sin segundos', () => {
        const m = mensajeParaCliente('confirmar', turno)
        expect(m).toContain('Corte y barba')
        expect(m).toContain('14:30')
        expect(m).not.toContain('14:30:00')
        expect(m).toMatch(/octubre/i)
    })

    it('cada tipo produce un texto distinto', () => {
        const textos = TIPOS_DE_MENSAJE.map((t) => mensajeParaCliente(t.id, turno))
        expect(new Set(textos).size).toBe(textos.length)
    })

    it('sin fecha u hora cae al saludo simple en vez de un mensaje cojo', () => {
        const m = mensajeParaCliente('confirmar', { ...turno, time: null })
        expect(m).toBe('Hola Ana! Te escribimos de Barone Barber.')
        expect(m).not.toContain('undefined')
        expect(m).not.toContain('a las .')
    })

    it('nunca escribe undefined ni null, falte lo que falte', () => {
        for (const t of TIPOS_DE_MENSAJE) {
            const m = mensajeParaCliente(t.id, {})
            expect(m).not.toMatch(/undefined|null|NaN/)
            expect(m.length).toBeGreaterThan(0)
        }
    })

    it('un tipo desconocido no rompe: cae al saludo', () => {
        const m = mensajeParaCliente('inventado', turno)
        expect(m).toContain('Hola Ana!')
    })

    it('sin nombre de cliente saluda igual, sin dejar el hueco', () => {
        const m = mensajeParaCliente('confirmar', { ...turno, clientName: null })
        expect(m.startsWith('Hola!')).toBe(true)
    })

    it('usa la plantilla personalizada para confirmar un turno', () => {
        const m = mensajeParaCliente(
            'confirmar',
            turno,
            'Hola {cliente}, soy de {negocio}. Te espero para {servicio} el {fecha} a las {hora}.',
        )
        expect(m).toBe('Hola Ana, soy de Barone Barber. Te espero para Corte y barba el jueves, 15 de octubre a las 14:30.')
    })

    it('conserva variables desconocidas para que el error sea visible', () => {
        expect(personalizarMensajeCliente('Hola {nombre}', turno)).toBe('Hola {nombre}')
    })
})

describe('el mensaje viaja bien dentro del link de WhatsApp', () => {
    it('arma un wa.me con el texto codificado', () => {
        const link = buildWhatsAppLink('1168727107', mensajeParaCliente('confirmar', turno))
        expect(link).toContain('https://wa.me/5491168727107')
        expect(link).toContain('?text=')
        // El texto tiene acentos y signos: tienen que ir escapados.
        expect(link).not.toContain(' ')
        expect(decodeURIComponent(link.split('?text=')[1])).toContain('Corte y barba')
    })

    it('sin teléfono usable no hay link, y el botón no se muestra', () => {
        expect(buildWhatsAppLink('', 'hola')).toBeNull()
        expect(buildWhatsAppLink('123', 'hola')).toBeNull()
    })
})
