import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// appUrl() lee process.env en cada llamada, así que se puede reconfigurar
// entre casos sin recargar el módulo.
import { appUrl, absoluteUrl, CANONICAL_URL } from '../app-url'

const original = process.env.NEXT_PUBLIC_APP_URL

function setEnv(v) {
    if (v === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = v
}

afterEach(() => setEnv(original))

describe('appUrl', () => {
    it('cae en el dominio canónico si la variable no está', () => {
        setEnv(undefined)
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })

    it('cae en el canónico si la variable está vacía', () => {
        setEnv('')
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })

    // El caso que rompió en producción: la variable en Vercel apuntaba al
    // dominio de vercel.app y todos los emails salían por ahí.
    it('respeta un dominio explícito distinto', () => {
        setEnv('https://glowup-turnos.vercel.app')
        expect(appUrl()).toBe('https://glowup-turnos.vercel.app')
    })

    it('manda el apex al www, que es a donde redirige el hosting', () => {
        setEnv('https://tu-glowup.com')
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })

    it('saca la barra final', () => {
        setEnv('https://www.tu-glowup.com/')
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })

    it('fuerza https en dominios públicos', () => {
        setEnv('http://www.tu-glowup.com')
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })

    it('deja http en localhost, que no tiene TLS', () => {
        setEnv('http://localhost:3000')
        expect(appUrl()).toBe('http://localhost:3000')
    })

    it('agrega el esquema si falta', () => {
        setEnv('www.tu-glowup.com')
        expect(appUrl()).toBe('https://www.tu-glowup.com')
    })
})

describe('absoluteUrl', () => {
    beforeEach(() => setEnv('https://www.tu-glowup.com'))

    it('arma una URL absoluta desde una ruta', () => {
        expect(absoluteUrl('/book/my-appointments'))
            .toBe('https://www.tu-glowup.com/book/my-appointments')
    })

    it('tolera rutas sin barra inicial', () => {
        expect(absoluteUrl('explore')).toBe('https://www.tu-glowup.com/explore')
    })

    it('nunca devuelve una URL relativa: dentro de un email no funcionaría', () => {
        setEnv('')
        expect(absoluteUrl('/cancel/abc').startsWith('https://')).toBe(true)
    })
})

describe('CANONICAL_URL', () => {
    it('es el www, no el apex', () => {
        expect(CANONICAL_URL).toBe('https://www.tu-glowup.com')
    })
})
