import { describe, it, expect } from 'vitest'
import { calcularGrilla, FORMATOS } from '../flyer'

const ANCHO = 900   // ancho útil típico dentro del margen
const ALTO = 700
const SEP = 22

describe('FORMATOS', () => {
    it('feed es 4:5 y historia 9:16, que es lo que pide Instagram', () => {
        expect(FORMATOS.feed.ancho / FORMATOS.feed.alto).toBeCloseTo(4 / 5, 3)
        expect(FORMATOS.historia.ancho / FORMATOS.historia.alto).toBeCloseTo(9 / 16, 3)
    })
})

describe('calcularGrilla', () => {
    it('sin horarios no dibuja nada', () => {
        expect(calcularGrilla(0, ANCHO, ALTO, SEP)).toEqual({
            columnas: 0, filas: 0, anchoChip: 0, altoChip: 0,
        })
    })

    it('con pocos horarios los pone en una sola fila', () => {
        for (const n of [1, 2, 3, 4]) {
            const g = calcularGrilla(n, ANCHO, ALTO, SEP)
            expect(g.columnas, `${n} horarios`).toBe(n)
            expect(g.filas).toBe(1)
        }
    })

    it('usa tres columnas en el rango habitual y cuatro cuando hay muchos', () => {
        expect(calcularGrilla(6, ANCHO, ALTO, SEP).columnas).toBe(3)
        expect(calcularGrilla(9, ANCHO, ALTO, SEP).columnas).toBe(3)
        expect(calcularGrilla(12, ANCHO, ALTO, SEP).columnas).toBe(3)
        expect(calcularGrilla(14, ANCHO, ALTO, SEP).columnas).toBe(4)
        expect(calcularGrilla(24, ANCHO, ALTO, SEP).columnas).toBe(4)
    })

    it('nunca deja más huecos que columnas', () => {
        for (let n = 1; n <= 40; n++) {
            const g = calcularGrilla(n, ANCHO, ALTO, SEP)
            const huecos = g.filas * g.columnas - n
            expect(huecos, `${n} horarios dejan ${huecos} huecos`).toBeLessThan(g.columnas)
        }
    })

    // El bug de la primera versión: con 14 horarios elegía 2 columnas por 7
    // filas y la grilla se desbordaba sobre el pie del flyer.
    it('la grilla SIEMPRE entra en el alto disponible', () => {
        for (const alto of [700, 500, 340, 1100]) {
            for (let n = 1; n <= 40; n++) {
                const g = calcularGrilla(n, ANCHO, alto, SEP)
                const usado = g.filas * g.altoChip + SEP * (g.filas - 1)
                expect(usado, `${n} horarios en ${alto}px se desbordan`).toBeLessThanOrEqual(alto + 0.01)
            }
        }
    })

    it('las filas siempre alcanzan para todos los horarios', () => {
        for (let n = 1; n <= 40; n++) {
            const g = calcularGrilla(n, ANCHO, ALTO, SEP)
            expect(g.filas * g.columnas, `${n}`).toBeGreaterThanOrEqual(n)
        }
    })

    it('los chips entran en el ancho disponible, contando la separación', () => {
        for (let n = 1; n <= 40; n++) {
            const g = calcularGrilla(n, ANCHO, ALTO, SEP)
            const usado = g.columnas * g.anchoChip + SEP * (g.columnas - 1)
            expect(usado, `${n} horarios se desbordan`).toBeLessThanOrEqual(ANCHO + 0.01)
            expect(g.anchoChip).toBeGreaterThan(0)
        }
    })

    it('pone un techo al alto para que con pocos turnos no queden enormes', () => {
        expect(calcularGrilla(2, ANCHO, ALTO, SEP).altoChip).toBeLessThanOrEqual(132)
        expect(calcularGrilla(1, ANCHO, 2000, SEP).altoChip).toBeLessThanOrEqual(132)
    })

    it('no devuelve NaN con medidas degeneradas', () => {
        for (const g of [calcularGrilla(5, 0, 0, SEP), calcularGrilla(5, 100, 10, 0)]) {
            expect(Number.isFinite(g.anchoChip)).toBe(true)
            expect(Number.isFinite(g.altoChip)).toBe(true)
        }
    })

    it('un día entero de turnos cada 30 min sigue entrando', () => {
        const g = calcularGrilla(22, ANCHO, ALTO, SEP)  // 9:00 a 20:00
        expect(g.columnas).toBeGreaterThan(0)
        expect(g.filas * g.columnas).toBeGreaterThanOrEqual(22)
    })
})
