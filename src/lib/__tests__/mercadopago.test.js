import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PLANS, createPlanPreference } from '../mercadopago'

/**
 * Este archivo creaba una preferencia REAL en Mercado Pago en cada corrida de
 * `npx vitest run`: pegaba contra api.mercadopago.com con el access token de
 * producción y dejaba un checkout colgado por cada ejecución de los tests.
 *
 * Un test no debe tener efectos afuera. Ahora se intercepta fetch y se
 * verifica lo que de verdad importa: QUÉ sobre se le manda a Mercado Pago.
 * Ahí viven los errores caros — un precio mal armado, un back_url al dominio
 * equivocado, un notification_url que no apunta al webhook.
 */

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_ENV = { ...process.env }

function mockMercadoPago() {
    const llamadas = []
    globalThis.fetch = vi.fn(async (url, opts) => {
        llamadas.push({ url, body: JSON.parse(opts.body), headers: opts.headers })
        return {
            ok: true,
            json: async () => ({
                id: 'pref-falsa-123',
                init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-falsa-123',
                sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-falsa-123',
            }),
        }
    })
    return llamadas
}

beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-token-de-mentira'
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.tu-glowup.com'
})

afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
})

const negocio = { id: 'biz-1', name: 'Barbería de Prueba' }

describe('PLANS', () => {
    it('define los tres planes con su precio y tope de sucursales', () => {
        expect(PLANS.base.price).toBe(15000)
        expect(PLANS.base.maxLocations).toBe(1)
        expect(PLANS.pro.price).toBe(20000)
        expect(PLANS.pro.maxLocations).toBe(1)
        expect(PLANS.multi.price).toBe(30000)
        expect(PLANS.multi.maxLocations).toBe(3)
        expect(PLANS.custom.maxLocations).toBe(999)
    })
})

describe('createPlanPreference — el sobre que se le manda a Mercado Pago', () => {
    it('cobra el precio del plan, no uno recibido de afuera', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference({ business: negocio, planId: 'base', userEmail: 'a@b.com' })
        expect(llamadas[0].body.items[0].unit_price).toBe(15000)
        expect(llamadas[0].body.items[0].currency_id).toBe('ARS')
    })

    it('manda el token en el header, nunca en el cuerpo', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference({ business: negocio, planId: 'pro', userEmail: 'a@b.com' })
        expect(llamadas[0].headers.Authorization).toBe('Bearer TEST-token-de-mentira')
        expect(JSON.stringify(llamadas[0].body)).not.toContain('TEST-token-de-mentira')
    })

    // Esto es lo que estaba roto en producción: NEXT_PUBLIC_APP_URL apuntaba a
    // vercel.app, así que el webhook y la vuelta del pago salían por ahí.
    it('apunta las URLs de retorno y el webhook al dominio propio', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference({ business: negocio, planId: 'base', userEmail: 'a@b.com' })
        const { back_urls, notification_url } = llamadas[0].body

        expect(notification_url).toBe('https://www.tu-glowup.com/api/mercadopago/webhook')
        for (const u of Object.values(back_urls)) {
            expect(u.startsWith('https://www.tu-glowup.com/')).toBe(true)
            expect(u).not.toContain('vercel.app')
        }
    })

    it('normaliza el apex al www también en las URLs del checkout', async () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://tu-glowup.com'
        const llamadas = mockMercadoPago()
        await createPlanPreference({ business: negocio, planId: 'base', userEmail: 'a@b.com' })
        expect(llamadas[0].body.notification_url).toBe('https://www.tu-glowup.com/api/mercadopago/webhook')
    })

    it('lleva business_id y plan_id en external_reference, que es lo que lee el webhook', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference({ business: negocio, planId: 'multi', userEmail: 'a@b.com' })
        const ref = JSON.parse(llamadas[0].body.external_reference)
        expect(ref.business_id).toBe('biz-1')
        expect(ref.plan_id).toBe('multi')
    })

    it('rechaza el plan personalizado, que se cierra hablando', async () => {
        mockMercadoPago()
        await expect(
            createPlanPreference({ business: negocio, planId: 'custom', userEmail: 'a@b.com' })
        ).rejects.toThrow()
    })

    it('rechaza un plan inexistente', async () => {
        mockMercadoPago()
        await expect(
            createPlanPreference({ business: negocio, planId: 'gratis-para-siempre', userEmail: 'a@b.com' })
        ).rejects.toThrow()
    })

    it('sin access token devuelve un link de demo y NO llama a Mercado Pago', async () => {
        delete process.env.MERCADOPAGO_ACCESS_TOKEN
        const llamadas = mockMercadoPago()
        const pref = await createPlanPreference({ business: negocio, planId: 'base', userEmail: 'a@b.com' })
        expect(pref.is_demo).toBe(true)
        expect(llamadas).toHaveLength(0)
    })

    it('propaga el error si Mercado Pago rechaza el pedido', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            json: async () => ({ message: 'invalid access token' }),
        }))
        await expect(
            createPlanPreference({ business: negocio, planId: 'base', userEmail: 'a@b.com' })
        ).rejects.toThrow(/invalid access token/)
    })
})
