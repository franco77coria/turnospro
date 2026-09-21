import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { PLANS, cancelSubscription } from '@/lib/mercadopago'
import { logError } from '@/lib/log'

/**
 * Webhook de Mercado Pago.
 *
 * Es el único lugar que puede decir "este negocio pagó", así que valida la
 * firma HMAC antes de tocar nada. Falla CERRADA: sin secreto configurado en
 * producción devuelve 503, y sin firma válida devuelve 401.
 *
 * Atiende tres tipos de aviso:
 *   - `payment`                          pago suelto (el modelo viejo, de un
 *                                        solo mes; sigue acá por los cobros
 *                                        que puedan estar en curso)
 *   - `subscription_preapproval`         la suscripción se creó, se pausó o
 *                                        se dio de baja
 *   - `subscription_authorized_payment`  el débito mensual de una suscripción
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

// Una firma válida pero vieja sigue siendo válida para siempre si no se mira
// el `ts`. Sin esto, quien capture UNA notificación aprobada puede reenviarla
// todos los meses y renovarse el plan gratis.
const TOLERANCIA_FIRMA_MS = 5 * 60 * 1000

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

    const tsNum = Number(ts)
    if (!Number.isFinite(tsNum)) return false
    if (Math.abs(Date.now() - tsNum) > TOLERANCIA_FIRMA_MS) {
        console.warn('[mp-webhook] firma fuera de la ventana de tolerancia', { ts })
        return false
    }

    const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`
    const esperada = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex')
    return firmaCoincide(esperada, v1)
}

/** Lee el `{business_id, plan_id}` que pusimos al crear el cobro. */
function leerReferencia(externalReference) {
    try {
        const ref = JSON.parse(externalReference || '{}')
        return { business_id: ref.business_id, plan_id: ref.plan_id }
    } catch {
        return {}
    }
}

/**
 * Da por pago un mes: extiende el vencimiento y deja el plan activo.
 *
 * `claveIdempotencia` es el id del cobro. La constraint única de
 * `mp_pagos_aplicados` es el candado: Mercado Pago reintenta las
 * notificaciones por diseño, y sin esto el mismo cobro sumaría 30 días
 * varias veces.
 */
async function activarPlan(supabase, { business_id, plan_id, claveIdempotencia, preapprovalId = null }) {
    const planInfo = PLANS[plan_id]
    if (!business_id || !planInfo) {
        return { ok: false, motivo: 'referencia_invalida' }
    }

    const { data, error } = await supabase.rpc('apply_mercadopago_payment', {
        p_payment_id: String(claveIdempotencia),
        p_business_id: business_id,
        p_plan_id: plan_id,
        p_max_locations: planInfo.maxLocations,
        p_preapproval_id: preapprovalId,
    })
    if (error) {
        logError('mp-webhook/activar', error, { business_id })
        return { ok: false, motivo: 'error_acreditacion' }
    }
    const previousId = data?.[0]?.previous_preapproval_id
    if (previousId) {
        try {
            await cancelSubscription(previousId)
            const { error: clearError } = await supabase.from('businesses')
                .update({ mp_previous_preapproval_id: null })
                .eq('id', business_id)
                .eq('mp_previous_preapproval_id', previousId)
            if (clearError) throw clearError
        } catch (cancelError) {
            logError('mp-webhook/cancelar-suscripcion-anterior', cancelError, { business_id })
            return { ok: false, motivo: 'error_cancelacion_anterior' }
        }
    }
    return { ok: true, motivo: data?.[0]?.applied ? 'activado' : 'ya_aplicado' }
}

/** Busca el negocio por el id de suscripción, cuando no viene la referencia. */
async function negocioPorSuscripcion(supabase, preapprovalId) {
    const { data } = await supabase
        .from('businesses')
        .select('id, plan_id, mp_pending_plan_id')
        .or(`mp_preapproval_id.eq.${preapprovalId},mp_pending_preapproval_id.eq.${preapprovalId}`)
        .maybeSingle()
    return data
}

async function mpGet(ruta, accessToken) {
    const res = await fetch(`https://api.mercadopago.com${ruta}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return res.json()
}

export async function POST(request) {
    try {
        const url = new URL(request.url)
        const tipo = url.searchParams.get('type') || url.searchParams.get('topic')
        const dataId = url.searchParams.get('data.id') || url.searchParams.get('id')

        const body = await request.json().catch(() => ({}))
        const recursoId = dataId || body?.data?.id || body?.id
        const tipoEvento = tipo || body?.type

        if (!recursoId) {
            return NextResponse.json({ status: 'ignored', reason: 'sin id' })
        }

        // --- Validación de firma, antes que cualquier otra cosa ---
        const secreto = env('MERCADOPAGO_WEBHOOK_SECRET')
        const esProduccion = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

        // `live_mode` venía del CUERPO del pedido, es decir, del que llama.
        // Mandando {"live_mode": false} se salteaba la firma por completo y se
        // podía reenviar el id de un pago aprobado para regalarse el plan.
        // La simulación solo se reconoce por el id fijo que manda el panel de
        // Mercado Pago, y únicamente fuera de producción.
        const esSimulacion = !esProduccion && String(recursoId) === '123456'

        if (!secreto) {
            if (esProduccion) {
                console.error('[mp-webhook] MERCADOPAGO_WEBHOOK_SECRET no configurado')
                return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 })
            }
            console.warn('[mp-webhook] sin secreto — validación omitida (solo fuera de producción)')
        } else if (!esSimulacion) {
            const signature = request.headers.get('x-signature') ?? ''
            const requestId = request.headers.get('x-request-id') ?? ''

            if (!firmaValida(secreto, signature, requestId, String(recursoId))) {
                console.warn('[mp-webhook] firma inválida o ausente', {
                    tieneFirma: Boolean(signature),
                    tieneRequestId: Boolean(requestId),
                })
                return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
            }
        }

        const accessToken = env('MERCADOPAGO_ACCESS_TOKEN')
        if (!accessToken) {
            console.warn('[mp-webhook] MERCADOPAGO_ACCESS_TOKEN no configurado')
            return NextResponse.json({ status: 'ignored', reason: 'sin access token' })
        }

        const supabase = getAdminSupabase()

        // ── El débito mensual de una suscripción ──
        if (tipoEvento === 'subscription_authorized_payment') {
            const cobro = await mpGet(`/authorized_payments/${recursoId}`, accessToken)
            if (!cobro) {
                return NextResponse.json({ status: 'error', reason: 'cobro no encontrado' }, { status: 400 })
            }

            // Un cobro programado puede quedar en reintento hasta 10 días. Solo
            // suma mes el que efectivamente se aprobó.
            const aprobado = cobro.payment?.status === 'approved' && Boolean(cobro.payment?.id)

            if (!aprobado) {
                return NextResponse.json({ status: 'ok', reason: `cobro ${cobro.status}` })
            }

            let { business_id, plan_id } = leerReferencia(cobro.external_reference)
            if (!business_id && cobro.preapproval_id) {
                const biz = await negocioPorSuscripcion(supabase, cobro.preapproval_id)
                business_id = biz?.id
                plan_id = biz?.mp_pending_plan_id || plan_id || biz?.plan_id
            }

            const res = await activarPlan(supabase, {
                business_id, plan_id, claveIdempotencia: cobro.payment.id, preapprovalId: cobro.preapproval_id || null,
            })
            return NextResponse.json({ status: res.ok ? 'ok' : 'error', reason: res.motivo },
                { status: res.ok ? 200 : 500 })
        }

        // ── Alta, pausa o baja de una suscripción ──
        if (tipoEvento === 'subscription_preapproval') {
            const sub = await mpGet(`/preapproval/${recursoId}`, accessToken)
            if (!sub) {
                return NextResponse.json({ status: 'error', reason: 'suscripción no encontrada' }, { status: 400 })
            }

            let { business_id, plan_id } = leerReferencia(sub.external_reference)
            if (!business_id) {
                const biz = await negocioPorSuscripcion(supabase, recursoId)
                business_id = biz?.id
                plan_id = biz?.mp_pending_plan_id || plan_id || biz?.plan_id
            }
            if (!business_id) {
                return NextResponse.json({ status: 'ignored', reason: 'sin negocio' })
            }

            if (sub.status === 'authorized') {
                // Autorización de tarjeta no equivale a pago aprobado.
                return NextResponse.json({ status: 'ok', reason: 'esperando primer cobro' })
            }

            if (sub.status === 'cancelled' || sub.status === 'paused') {
                // Si se canceló durante el checkout, liberar el cambio
                // pendiente sin tocar el plan anterior ya pagado.
                const { error: pendingError } = await supabase
                    .from('businesses')
                    .update({ mp_pending_preapproval_id: null, mp_pending_plan_id: null })
                    .eq('id', business_id)
                    .eq('mp_pending_preapproval_id', String(recursoId))
                if (pendingError) throw pendingError
                // NO se le corta el servicio acá: los días que ya pagó los
                // conserva hasta plan_expires_at. Solo deja de renovarse.
                const { error: statusError } = await supabase
                    .from('businesses')
                    .update({ plan_status: sub.status === 'paused' ? 'paused' : 'cancelled' })
                    .eq('id', business_id)
                    .eq('mp_preapproval_id', String(recursoId))
                if (statusError) throw statusError
                return NextResponse.json({ status: 'ok', reason: sub.status })
            }

            return NextResponse.json({ status: 'ok', reason: `estado ${sub.status}` })
        }

        // ── Pago suelto (modelo viejo, de un mes) ──
        const pago = await mpGet(`/v1/payments/${recursoId}`, accessToken)
        if (!pago) {
            return NextResponse.json({ status: 'error', reason: 'pago no encontrado' }, { status: 400 })
        }

        if (pago.status !== 'approved') {
            return NextResponse.json({ status: 'ok', paymentStatus: pago.status })
        }

        const { business_id, plan_id } = leerReferencia(pago.external_reference)
        const res = await activarPlan(supabase, {
            business_id, plan_id, claveIdempotencia: pago.id, preapprovalId: pago.preapproval_id || null,
        })

        return NextResponse.json({ status: res.ok ? 'ok' : 'error', reason: res.motivo },
            { status: res.ok ? 200 : 500 })
    } catch (err) {
        logError('mp-webhook', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Mercado Pago también realiza solicitudes GET/HEAD para verificar que la URL
// de webhook está activa.
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'GLOWUP MercadoPago Webhook' })
}
