import { describe, it, expect } from 'vitest'
import {
    hexARgb, rgbAHex, luminancia, contraste, mezclar, variantelegible,
    derivarPaleta, resolverTema, TEMAS, TEMA_POR_DEFECTO, buscarTema,
} from '../theme'

const PAPEL_CLARO = '#FFFFFF'
const PAPEL_OSCURO = '#1A0F22'
const AA = 4.5

describe('conversión de color', () => {
    it('parsea hex de 6 y de 3 dígitos', () => {
        expect(hexARgb('#FF2E8E')).toEqual({ r: 255, g: 46, b: 142 })
        expect(hexARgb('#F0A')).toEqual({ r: 255, g: 0, b: 170 })
    })
    it('tolera el hex sin numeral y con espacios', () => {
        expect(hexARgb('  ff2e8e ')).toEqual({ r: 255, g: 46, b: 142 })
    })
    it('devuelve null ante basura, en vez de un color inventado', () => {
        expect(hexARgb('no-es-color')).toBeNull()
        expect(hexARgb('#GGGGGG')).toBeNull()
        expect(hexARgb(null)).toBeNull()
        expect(hexARgb(123)).toBeNull()
    })
    it('ida y vuelta sin pérdida', () => {
        expect(rgbAHex(hexARgb('#FF2E8E'))).toBe('#FF2E8E')
    })
    it('satura en vez de desbordar', () => {
        expect(rgbAHex({ r: 300, g: -20, b: 128 })).toBe('#FF0080')
    })
})

describe('contraste (WCAG)', () => {
    it('blanco contra negro da 21:1', () => {
        expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    })
    it('un color contra sí mismo da 1:1', () => {
        expect(contraste('#FF2E8E', '#FF2E8E')).toBeCloseTo(1, 5)
    })
    it('es simétrico', () => {
        expect(contraste('#FF2E8E', '#FFF')).toBeCloseTo(contraste('#FFF', '#FF2E8E'), 6)
    })
    // El comentario de globals.css dice que el rosa de marca da 3.48:1 sobre
    // blanco: por debajo de AA. Ese es justamente el motivo de --pink-ink.
    it('confirma que el rosa de marca NO alcanza AA como texto', () => {
        expect(contraste('#FF2E8E', PAPEL_CLARO)).toBeLessThan(AA)
    })
})

describe('variantelegible', () => {
    it('devuelve el color intacto si ya contrasta', () => {
        expect(variantelegible('#000000', PAPEL_CLARO)).toBe('#000000')
    })
    it('oscurece hasta cruzar AA sobre fondo claro', () => {
        const ink = variantelegible('#FF2E8E', PAPEL_CLARO)
        expect(contraste(ink, PAPEL_CLARO)).toBeGreaterThanOrEqual(AA)
    })
    it('aclara hasta cruzar AA sobre fondo oscuro', () => {
        const ink = variantelegible('#2563EB', PAPEL_OSCURO)
        expect(contraste(ink, PAPEL_OSCURO)).toBeGreaterThanOrEqual(AA)
    })
    it('funciona incluso partiendo del amarillo, que es el caso más difícil', () => {
        const ink = variantelegible('#FFE600', PAPEL_CLARO)
        expect(contraste(ink, PAPEL_CLARO)).toBeGreaterThanOrEqual(AA)
    })
})

describe('derivarPaleta', () => {
    it('el tema por defecto conserva EXACTAMENTE los colores actuales de la app', () => {
        expect(TEMA_POR_DEFECTO.primario).toBe('#FF2E8E')
        expect(TEMA_POR_DEFECTO.secundario).toBe('#6E2BFF')
        const { claro } = derivarPaleta(TEMA_POR_DEFECTO.primario, TEMA_POR_DEFECTO.secundario)
        expect(claro['--pink']).toBe('#FF2E8E')
        expect(claro['--violet']).toBe('#6E2BFF')
    })

    it('genera todos los tokens que el CSS pide', () => {
        const { claro, oscuro } = derivarPaleta('#2563EB', '#06B6D4')
        for (const t of ['--pink', '--pink-deep', '--pink-soft', '--pink-tint', '--pink-ink',
                         '--violet', '--violet-deep', '--violet-soft', '--violet-tint',
                         '--shadow-pink', '--shadow-violet']) {
            expect(claro[t], `falta ${t}`).toBeTruthy()
        }
        for (const t of ['--pink-tint', '--pink-soft', '--pink-ink', '--violet-tint', '--violet-soft']) {
            expect(oscuro[t], `falta ${t} en oscuro`).toBeTruthy()
        }
    })

    // Lo importante de todo el sistema: NINGÚN tema puede dejar texto ilegible.
    it('TODOS los temas dan un --pink-ink legible en claro y en oscuro', () => {
        for (const tema of TEMAS) {
            const { claro, oscuro } = derivarPaleta(tema.primario, tema.secundario)
            expect(contraste(claro['--pink-ink'], PAPEL_CLARO),
                `${tema.nombre} ilegible en claro`).toBeGreaterThanOrEqual(AA)
            expect(contraste(oscuro['--pink-ink'], PAPEL_OSCURO),
                `${tema.nombre} ilegible en oscuro`).toBeGreaterThanOrEqual(AA)
        }
    })

    it('el tinte es más claro que el suave, y el suave más que el base', () => {
        for (const tema of TEMAS) {
            const { claro } = derivarPaleta(tema.primario, tema.secundario)
            expect(luminancia(claro['--pink-tint'])).toBeGreaterThan(luminancia(claro['--pink-soft']))
            expect(luminancia(claro['--pink-soft'])).toBeGreaterThan(luminancia(claro['--pink']))
        }
    })

    it('el deep es más oscuro que el base, para que el hover se note', () => {
        for (const tema of TEMAS) {
            const { claro } = derivarPaleta(tema.primario, tema.secundario)
            expect(luminancia(claro['--pink-deep'])).toBeLessThan(luminancia(claro['--pink']))
        }
    })

    // Los botones principales son texto blanco sobre el color de marca (13
    // reglas del CSS). Un color claro los dejaría ilegibles.
    it('garantiza 3:1 contra blanco para cualquier color, incluido el amarillo', () => {
        for (const elegido of ['#FFE600', '#FFFFFF', '#A7F3D0', '#FFD1DC', '#00FFFF']) {
            const { claro } = derivarPaleta(elegido, elegido)
            expect(contraste(claro['--pink'], '#FFFFFF'),
                `${elegido} deja el botón ilegible`).toBeGreaterThanOrEqual(3)
        }
    })

    it('NINGÚN preset se mueve por el acotado: la app se ve igual que hoy', () => {
        for (const tema of TEMAS) {
            const { claro } = derivarPaleta(tema.primario, tema.secundario)
            expect(claro['--pink'], tema.nombre).toBe(tema.primario)
            expect(claro['--violet'], tema.nombre).toBe(tema.secundario)
        }
    })

    it('la sombra sale como rgba() válido con el color elegido', () => {
        const { claro } = derivarPaleta('#2563EB', '#06B6D4')
        expect(claro['--shadow-pink']).toBe('0 12px 30px rgba(37, 99, 235, 0.28)')
    })

    it('un color inválido cae al tema por defecto en vez de romper', () => {
        const { claro } = derivarPaleta('no-es-color', 'tampoco')
        expect(claro['--pink']).toBe('#FF2E8E')
    })
})

describe('resolverTema', () => {
    it('sin valor guardado devuelve el tema actual de la app', () => {
        expect(resolverTema(null).id).toBe('rosa')
        expect(resolverTema(undefined).id).toBe('rosa')
    })
    it('acepta un id de preset', () => {
        expect(resolverTema('azul').primario).toBe('#2563EB')
    })
    it('acepta un objeto con id', () => {
        expect(resolverTema({ id: 'verde' }).primario).toBe('#059669')
    })
    it('acepta un par de hex propio', () => {
        const t = resolverTema({ id: 'custom', primario: '#123456', secundario: '#654321' })
        expect(t.primario).toBe('#123456')
        expect(t.secundario).toBe('#654321')
    })
    it('con primario propio y sin secundario, deriva uno en vez de quedar roto', () => {
        const t = resolverTema({ id: 'custom', primario: '#123456' })
        expect(hexARgb(t.secundario)).not.toBeNull()
    })
    it('un id inexistente cae al defecto', () => {
        expect(resolverTema('fucsia-neon').id).toBe('rosa')
    })
    // Un valor corrupto en la base no puede dejar la app sin colores.
    it('sobrevive a basura guardada', () => {
        for (const basura of [{}, [], 42, { primario: 'xx' }, { id: null }, '']) {
            expect(resolverTema(basura).primario).toBe('#FF2E8E')
        }
    })
})

describe('catálogo de temas', () => {
    it('los ids son únicos', () => {
        expect(new Set(TEMAS.map((t) => t.id)).size).toBe(TEMAS.length)
    })
    it('todos tienen hex válidos', () => {
        for (const t of TEMAS) {
            expect(hexARgb(t.primario), t.id).not.toBeNull()
            expect(hexARgb(t.secundario), t.id).not.toBeNull()
        }
    })
    it('buscarTema devuelve null si no existe', () => {
        expect(buscarTema('nope')).toBeNull()
    })
})

describe('mezclar', () => {
    it('t=0 devuelve el primero y t=1 el segundo', () => {
        expect(mezclar('#FF0000', '#0000FF', 0)).toBe('#FF0000')
        expect(mezclar('#FF0000', '#0000FF', 1)).toBe('#0000FF')
    })
    it('t=0.5 queda en el medio', () => {
        expect(mezclar('#000000', '#FFFFFF', 0.5)).toBe('#808080')
    })
    it('recorta t fuera de rango', () => {
        expect(mezclar('#FF0000', '#0000FF', 5)).toBe('#0000FF')
        expect(mezclar('#FF0000', '#0000FF', -3)).toBe('#FF0000')
    })
})
