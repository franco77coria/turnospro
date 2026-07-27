import { describe, it, expect } from 'vitest'
import { PLANS, createPlanPreference } from '../mercadopago'

describe('Mercado Pago SaaS Subscriptions', () => {
    it('defines the 3 plans correctly according to user specifications', () => {
        expect(PLANS.base.price).toBe(15000)
        expect(PLANS.base.maxLocations).toBe(1)

        expect(PLANS.pro.price).toBe(20000)
        expect(PLANS.pro.maxLocations).toBe(1)

        expect(PLANS.multi.price).toBe(30000)
        expect(PLANS.multi.maxLocations).toBe(3)

        expect(PLANS.custom.maxLocations).toBe(999)
    })

    it('creates a checkout preference structure cleanly via Mercado Pago API', async () => {
        // Cargar .env.local manualmente en el test
        const dotenv = await import('dotenv')
        dotenv.config({ path: '.env.local' })

        const mockBusiness = {
            id: 'test-biz-id-123',
            name: 'Barbería El Patrón Test',
        }

        const preference = await createPlanPreference({
            business: mockBusiness,
            planId: 'base',
            userEmail: 'testowner@gmail.com'
        })

        expect(preference).toBeDefined()
        expect(preference.init_point).toContain('mercadopago.com')
        console.log('✅ PREFERENCIA MERCADO PAGO CREADA EXITOSAMENTE EN VIVO:', preference.init_point)
    })
})
