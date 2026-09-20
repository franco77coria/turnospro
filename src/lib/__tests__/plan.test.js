import { describe, it, expect } from 'vitest'
import { planVigente, diasParaVencer, rutaPermitidaSinPlan, RUTAS_SIN_PLAN } from '../plan'

const AHORA = new Date('2026-09-20T12:00:00Z')
const enDias = (n) => new Date(AHORA.getTime() + n * 86400000).toISOString()

describe('planVigente', () => {
    it('habilita un plan activo que todavía no venció', () => {
        expect(planVigente({ plan_status: 'active', plan_expires_at: enDias(10) }, AHORA)).toBe(true)
    })

    it('habilita la prueba gratis mientras dure', () => {
        expect(planVigente({ plan_status: 'trialing', plan_expires_at: enDias(3) }, AHORA)).toBe(true)
    })

    // La decisión tomada: corte inmediato, sin días de gracia.
    it('corta apenas vence, sin gracia', () => {
        expect(planVigente({ plan_status: 'active', plan_expires_at: enDias(-0.01) }, AHORA)).toBe(false)
    })

    it('corta también la prueba vencida', () => {
        expect(planVigente({ plan_status: 'trialing', plan_expires_at: enDias(-1) }, AHORA)).toBe(false)
    })

    // Dar de baja no quita los días ya pagados: manda la fecha, no el estado.
    it('una baja con días pagados por delante SIGUE habilitada', () => {
        expect(planVigente({ plan_status: 'cancelled', plan_expires_at: enDias(12) }, AHORA)).toBe(true)
    })

    it('una pausa con días pagados por delante también sigue habilitada', () => {
        expect(planVigente({ plan_status: 'paused', plan_expires_at: enDias(5) }, AHORA)).toBe(true)
    })

    it('pero una baja ya vencida no', () => {
        expect(planVigente({ plan_status: 'cancelled', plan_expires_at: enDias(-2) }, AHORA)).toBe(false)
    })

    // Cortarle el servicio a alguien por un dato que nunca tuvo sería un
    // error nuestro, no una falta de pago suya.
    it('sin fecha de vencimiento no bloquea', () => {
        expect(planVigente({ plan_status: 'active' }, AHORA)).toBe(true)
        expect(planVigente({ plan_status: 'trialing', plan_expires_at: null }, AHORA)).toBe(true)
    })

    it('una fecha corrupta tampoco bloquea', () => {
        expect(planVigente({ plan_status: 'active', plan_expires_at: 'no-es-fecha' }, AHORA)).toBe(true)
    })

    it('un estado desconocido no habilita', () => {
        expect(planVigente({ plan_status: 'moroso', plan_expires_at: enDias(10) }, AHORA)).toBe(false)
    })

    it('sin negocio no habilita', () => {
        expect(planVigente(null, AHORA)).toBe(false)
        expect(planVigente(undefined, AHORA)).toBe(false)
    })

    it('sin estado asume prueba, que es como nace un negocio', () => {
        expect(planVigente({ plan_expires_at: enDias(2) }, AHORA)).toBe(true)
    })
})

describe('diasParaVencer', () => {
    it('cuenta los días que faltan', () => {
        expect(diasParaVencer({ plan_expires_at: enDias(7) }, AHORA)).toBe(7)
    })
    it('da negativo si ya venció', () => {
        expect(diasParaVencer({ plan_expires_at: enDias(-3) }, AHORA)).toBe(-3)
    })
    it('devuelve null si no hay fecha', () => {
        expect(diasParaVencer({}, AHORA)).toBeNull()
        expect(diasParaVencer(null, AHORA)).toBeNull()
    })
})

describe('rutaPermitidaSinPlan', () => {
    // Bloquear la pantalla de suscripción dejaría al negocio sin forma de
    // reactivarse: quedaría encerrado afuera y sin poder pagar.
    it('deja entrar a suscripción, para que pueda pagar', () => {
        expect(rutaPermitidaSinPlan('/dashboard/subscription')).toBe(true)
    })

    it('deja entrar a ajustes, para que pueda sacar sus datos', () => {
        expect(rutaPermitidaSinPlan('/dashboard/settings')).toBe(true)
    })

    it('bloquea el resto del panel', () => {
        for (const r of ['/dashboard', '/dashboard/calendar', '/dashboard/clients',
                         '/dashboard/finance', '/dashboard/pos', '/dashboard/marketing']) {
            expect(rutaPermitidaSinPlan(r), r).toBe(false)
        }
    })

    it('las subrutas de lo permitido también entran', () => {
        expect(rutaPermitidaSinPlan('/dashboard/settings/perfil')).toBe(true)
    })

    it('no se cuela una ruta que solo empieza parecido', () => {
        expect(rutaPermitidaSinPlan('/dashboard/subscriptions-falso')).toBe(false)
    })

    it('tolera un pathname vacío', () => {
        expect(rutaPermitidaSinPlan('')).toBe(false)
        expect(rutaPermitidaSinPlan(null)).toBe(false)
    })

    it('la lista de rutas abiertas es la mínima indispensable', () => {
        expect(RUTAS_SIN_PLAN).toHaveLength(2)
    })
})
