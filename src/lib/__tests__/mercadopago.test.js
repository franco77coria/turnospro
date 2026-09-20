import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    PLANS, createPlanPreference, createPlanSubscription,
    cancelSubscription, getSubscription,
} from '../mercadopago'

/**
 * Este archivo creaba una preferencia REAL en Mercado Pago en cada corrida de
 * `npx vitest run`: pegaba contra api.mercadopago.com con el access token de
 * producción y dejaba un checkout colgado por ejecución.
 *
 * Un test no debe tener efectos afuera. Ahora se intercepta fetch y se
 * verifica lo que de verdad importa: QUÉ sobre se le manda a Mercado Pago.
 * Ahí viven los errores caros — un monto mal armado, una frecuencia
 * equivocada, un back_url al dominio que no es.
 */

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_ENV = { ...process.env }

function mockMercadoPago(respuesta = {}) {
    const llamadas = []
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
        llamadas.push({
            url,
            metodo: opts.method || 'GET',
            body: opts.body ? JSON.parse(opts.body) : null,
            headers: opts.headers || {},
        })
        return {
            ok: true,
            json: async () => ({
                id: '2c938084726fca480172750000000000',
                init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=abc',
                status: 'pending',
                ...respuesta,
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
const alta = (over = {}) => ({ business: negocio, planId: 'base', userEmail: 'a@b.com', ...over })

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

describe('createPlanSubscription — débito automático mensual', () => {
    it('pega contra /preapproval, que es la API de suscripciones', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta())
        expect(llamadas[0].url).toBe('https://api.mercadopago.com/preapproval')
        expect(llamadas[0].metodo).toBe('POST')
    })

    // Lo que convierte esto en una suscripción y no en un pago suelto.
    it('configura la recurrencia en 1 mes con el precio del plan', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta({ planId: 'multi' }))
        expect(llamadas[0].body.auto_recurring).toEqual({
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 30000,
            currency_id: 'ARS',
        })
    })

    // status 'pending' = la tarjeta la carga el dueño en el checkout de
    // Mercado Pago. Sin esto habría que recibir la tarjeta en nuestro
    // servidor, con toda la carga de PCI que eso implica.
    it('usa status pending para que la tarjeta no pase por nuestro servidor', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta())
        expect(llamadas[0].body.status).toBe('pending')
        expect(llamadas[0].body.card_token_id).toBeUndefined()
    })

    it('manda el token en el header, nunca en el cuerpo', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta())
        expect(llamadas[0].headers.Authorization).toBe('Bearer TEST-token-de-mentira')
        expect(JSON.stringify(llamadas[0].body)).not.toContain('TEST-token-de-mentira')
    })

    it('lleva business_id y plan_id en external_reference, que es lo que lee el webhook', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta({ planId: 'pro' }))
        const ref = JSON.parse(llamadas[0].body.external_reference)
        expect(ref).toEqual({ business_id: 'biz-1', plan_id: 'pro' })
    })

    // Esto es lo que estaba roto en producción: NEXT_PUBLIC_APP_URL apuntaba
    // a vercel.app y la vuelta del pago salía por ahí.
    it('vuelve al dominio propio después del pago', async () => {
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta())
        expect(llamadas[0].body.back_url.startsWith('https://www.tu-glowup.com/')).toBe(true)
        expect(llamadas[0].body.back_url).not.toContain('vercel.app')
    })

    it('normaliza el apex al www también acá', async () => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://tu-glowup.com'
        const llamadas = mockMercadoPago()
        await createPlanSubscription(alta())
        expect(llamadas[0].body.back_url).toContain('https://www.tu-glowup.com/')
    })

    it('devuelve el id y el init_point, que son los dos datos que se usan', async () => {
        mockMercadoPago()
        const sub = await createPlanSubscription(alta())
        expect(sub.id).toBeTruthy()
        expect(sub.init_point).toContain('mercadopago')
    })

    it('rechaza el plan personalizado, que se cierra hablando', async () => {
        mockMercadoPago()
        await expect(createPlanSubscription(alta({ planId: 'custom' }))).rejects.toThrow()
    })

    it('rechaza un plan inexistente', async () => {
        mockMercadoPago()
        await expect(createPlanSubscription(alta({ planId: 'gratis' }))).rejects.toThrow()
    })

    // Sin email no hay a quién debitarle: mejor fallar acá que crear una
    // suscripción huérfana en Mercado Pago.
    it('exige el email del titular', async () => {
        mockMercadoPago()
        await expect(createPlanSubscription(alta({ userEmail: null }))).rejects.toThrow()
    })

    it('sin access token devuelve un link de demo y NO llama a Mercado Pago', async () => {
        delete process.env.MERCADOPAGO_ACCESS_TOKEN
        const llamadas = mockMercadoPago()
        const sub = await createPlanSubscription(alta())
        expect(sub.is_demo).toBe(true)
        expect(llamadas).toHaveLength(0)
    })

    it('propaga el error si Mercado Pago rechaza el alta', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            json: async () => ({ message: 'invalid payer_email' }),
        }))
        await expect(createPlanSubscription(alta())).rejects.toThrow(/invalid payer_email/)
    })
})

describe('cancelSubscription', () => {
    it('manda PUT con status cancelled a la suscripción', async () => {
        const llamadas = mockMercadoPago({ status: 'cancelled' })
        await cancelSubscription('sub-123')
        expect(llamadas[0].url).toBe('https://api.mercadopago.com/preapproval/sub-123')
        expect(llamadas[0].metodo).toBe('PUT')
        expect(llamadas[0].body).toEqual({ status: 'cancelled' })
    })

    it('falla si no hay access token, en vez de fingir que canceló', async () => {
        delete process.env.MERCADOPAGO_ACCESS_TOKEN
        await expect(cancelSubscription('sub-123')).rejects.toThrow()
    })
})

describe('getSubscription', () => {
    it('consulta el estado real en Mercado Pago', async () => {
        const llamadas = mockMercadoPago({ status: 'authorized' })
        const sub = await getSubscription('sub-123')
        expect(llamadas[0].url).toBe('https://api.mercadopago.com/preapproval/sub-123')
        expect(sub.status).toBe('authorized')
    })
})

// El modelo viejo sigue existiendo por los cobros que puedan estar en curso.
describe('createPlanPreference — pago suelto (modelo anterior)', () => {
    it('sigue armando la preferencia con el precio del plan', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference(alta())
        expect(llamadas[0].url).toBe('https://api.mercadopago.com/checkout/preferences')
        expect(llamadas[0].body.items[0].unit_price).toBe(15000)
    })

    it('apunta el webhook al dominio propio', async () => {
        const llamadas = mockMercadoPago()
        await createPlanPreference(alta())
        expect(llamadas[0].body.notification_url)
            .toBe('https://www.tu-glowup.com/api/mercadopago/webhook')
    })
})
