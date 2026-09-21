import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, createClient } = vi.hoisted(() => {
    const rpc = vi.fn()
    return { rpc, createClient: vi.fn(() => ({ rpc })) }
})

vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('@/lib/log', () => ({ logError: vi.fn() }))

import { POST } from './route'

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

function signedRequest(type, id, { body = {}, valid = true } = {}) {
    const ts = String(Date.now())
    const requestId = 'qa-request'
    const manifest = `id:${id};request-id:${requestId};ts:${ts};`
    const signature = crypto.createHmac('sha256', valid ? 'qa-secret' : 'wrong-secret')
        .update(manifest).digest('hex')
    return new Request(`http://localhost/api/mercadopago/webhook?type=${type}&data.id=${id}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-request-id': requestId,
            'x-signature': `ts=${ts},v1=${signature}`,
        },
        body: JSON.stringify(body),
    })
}

beforeEach(() => {
    process.env.VERCEL_ENV = 'production'
    process.env.MERCADOPAGO_WEBHOOK_SECRET = 'qa-secret'
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-qa'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'qa-service'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    rpc.mockResolvedValue({ data: [{ applied: true, previous_preapproval_id: null }], error: null })
})

afterEach(() => {
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
    vi.clearAllMocks()
})

describe('Mercado Pago webhook', () => {
    it('rechaza una firma falsa aunque el cuerpo diga live_mode false', async () => {
        const mpFetch = vi.fn()
        globalThis.fetch = mpFetch
        const response = await POST(signedRequest('payment', '123', {
            body: { live_mode: false }, valid: false,
        }))
        expect(response.status).toBe(401)
        expect(mpFetch).not.toHaveBeenCalled()
        expect(createClient).not.toHaveBeenCalled()
    })

    it('no acredita un plan al autorizar una suscripción sin primer cobro', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(Response.json({
            id: 'sub-1', status: 'authorized',
            external_reference: JSON.stringify({ business_id: 'biz-1', plan_id: 'pro' }),
        }))
        const response = await POST(signedRequest('subscription_preapproval', 'sub-1'))
        expect(response.status).toBe(200)
        expect((await response.json()).reason).toBe('esperando primer cobro')
        expect(rpc).not.toHaveBeenCalled()
    })

    it('acredita por el ID del pago aprobado tras validar la firma', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(Response.json({
            id: 'invoice-1', status: 'processed', preapproval_id: 'sub-1',
            payment: { id: 9876, status: 'approved' },
            external_reference: JSON.stringify({ business_id: 'biz-1', plan_id: 'pro' }),
        }))
        const response = await POST(signedRequest('subscription_authorized_payment', 'invoice-1'))
        expect(response.status).toBe(200)
        expect(rpc).toHaveBeenCalledWith('apply_mercadopago_payment', expect.objectContaining({
            p_payment_id: '9876', p_business_id: 'biz-1', p_plan_id: 'pro',
            p_preapproval_id: 'sub-1',
        }))
    })
})
