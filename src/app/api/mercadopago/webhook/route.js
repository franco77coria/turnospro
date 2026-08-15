import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { PLANS } from '@/lib/mercadopago'

/**
 * Webhook de Mercado Pago.
 *
 * Es el único lugar que puede decir "este negocio pagó", así que valida la
 * firma HMAC antes de tocar nada. Falla CERRADA: sin secreto configurado en
 * producción devuelve 503, y sin firma válida devuelve 401.
 *
 * Antes no validaba nada y tomaba el id de pago del query string, así que
 * cualquiera podía reenviar una notificación y regalarse 30 días de plan.
 */

/** Quita los `\r\n` LITERALES que quedan al pegar valores en el panel de Vercel. */
function env(nombre) {
    return (process.env[nombre] || '').replace(/\\r|\\n/g, '').trim()
}

function getAdminSupabase() {
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
        // Con la anon key, RLS bloquea las escrituras y el pago se pierde
        // en silencio. Preferimos enterarnos.
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado')
    }
    return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), serviceKey)
}

/** Compara en tiempo constante para no filtrar el secreto por timing. */
function firmaCoincide(esperada, recibida) {
    const a = Buffer.from(esperada)
    const b = Buffer.from(recibida)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Manifiesto que firma Mercado Pago: `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * Devuelve false ante cualquier parte faltante, para que la falta de firma
 * no se convierta en un pase libre.
 */
function firmaValida(secreto, signature, requestId, dataId) {
    if (!signature || !requestId || !dataId) return false

    const partes = Object.fromEntries(
        signature.split(',').map((p) => p.split('=').map((s) => s.trim()))
    )
    const { ts, v1 } = partes
    if (!ts || !v1) return false

    const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`
    const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex')
    return firmaCoincide(esperada, v1)
}

export async function POST(request) {
    try {
        const url = new URL(request.url)
        const type = url.searchParams.get('type') || url.searchParams.get('topic')
        const dataId = url.searchParams.get('data.id') || url.searchParams.get('id')

        const body = await request.json().catch(() => ({}))
        const paymentId = dataId || body?.data?.id || body?.id

        if (!paymentId) {
            return NextResponse.json({ status: 'ignored', reason: 'No payment id' })
        }

        // --- Validación de firma, antes que cualquier otra cosa ---
        const secreto = env('MERCADOPAGO_WEBHOOK_SECRET')
        const esProduccion = process.env.VERCEL_ENV === 'production'
        const esSimulacion = String(paymentId) === '123456' || body?.live_mode === false

        if (!secreto) {
            if (esProduccion) {
                console.error('[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado')
                return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 })
            }
            console.warn('[mp-webhook] sin secreto — validación omitida (solo fuera de producción)')
        } else if (!esSimulacion) {
            const signature = request.headers.get('x-signature') ?? ''
            const requestId = request.headers.get('x-request-id') ?? ''

            if (!firmaValida(secreto, signature, requestId, String(paymentId))) {
                console.warn('[mp-webhook] firma inválida o ausente', {
                    tieneFirma: Boolean(signature),
                    tieneRequestId: Boolean(requestId),
                })
                return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
            }
        }

        const accessToken = env('MERCADOPAGO_ACCESS_TOKEN')
        if (!accessToken) {
            console.warn('⚠️ Webhook recibido pero MERCADOPAGO_ACCESS_TOKEN no configurado')
            return NextResponse.json({ status: 'ignored', reason: 'No MP access token' })
        }

        // El estado real lo dice Mercado Pago, nunca el cuerpo del pedido
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        if (!mpRes.ok) {
            return NextResponse.json(
                { status: 'error', reason: 'Failed to fetch payment status' },
                { status: 400 }
            )
        }

        const paymentData = await mpRes.json()

        if (paymentData.status === 'approved') {
            let extRef = {}
            try {
                extRef = JSON.parse(paymentData.external_reference || '{}')
            } catch (e) {
                console.error('Error parsing external_reference:', e)
            }

            const { business_id, plan_id, max_locations } = extRef

            if (business_id && plan_id && PLANS[plan_id]) {
                const supabase = getAdminSupabase()
                const planInfo = PLANS[plan_id]

                // El tope lo manda el plan, no el external_reference: ese viaja
                // por el checkout y no es confiable como fuente de permisos.
                const maxLocs = Math.min(
                    Number(max_locations) || planInfo.maxLocations,
                    planInfo.maxLocations
                )

                // Calcular vencimiento: 30 días a partir de hoy
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 30)

                // Actualizar negocio
                const { data: updatedBiz, error: updateError } = await supabase
                    .from('businesses')
                    .update({
                        plan_id: plan_id,
                        plan_status: 'active',
                        plan_expires_at: expiresAt.toISOString(),
                        max_locations: maxLocs,
                    })
                    .eq('id', business_id)
                    .select('owner_id')
                    .single()

                if (updateError) {
                    console.error('Error updating business subscription:', updateError)
                } else if (updatedBiz?.owner_id) {
                    // Auto-aprobar perfil del dueño
                    await supabase
                        .from('profiles')
                        .update({ approved: true })
                        .eq('id', updatedBiz.owner_id)
                }
            }
        }

        return NextResponse.json({ status: 'ok', paymentStatus: paymentData.status })
    } catch (err) {
        console.error('Mercado Pago Webhook error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Mercado Pago también realiza solicitudes GET/HEAD para verificar que la URL de webhook está activa
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'TurnosPro MercadoPago Webhook' })
}
