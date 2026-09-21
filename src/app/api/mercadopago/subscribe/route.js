import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createPlanSubscription, cancelSubscription, PLANS } from '@/lib/mercadopago'
import { applyRateLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * POST — arranca una suscripción con débito automático mensual.
 *
 * Antes creaba una preferencia de Checkout Pro: un pago único al que el
 * webhook le sumaba 30 días. Eso obligaba al dueño a acordarse de pagar todos
 * los meses, y si se olvidaba se le cortaba el servicio.
 */
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const supabase = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // Crear suscripciones es una operación con plata de por medio: se
        // limita para que un bug en el front no dispare veinte checkouts.
        const limitado = await applyRateLimit(request, {
            prefix: `subscribe:${user.id}`,
            limit: 5,
            windowMs: 60_000,
        })
        if (limitado) return limitado

        const body = await request.json().catch(() => ({}))
        const { planId, businessId } = body

        if (!planId || !PLANS[planId]) {
            return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
        }
        if (planId === 'custom') {
            return NextResponse.json(
                { error: 'El plan personalizado requiere contacto directo' },
                { status: 400 }
            )
        }

        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id, name, mp_preapproval_id, mp_pending_preapproval_id, mp_previous_preapproval_id')
            .eq('id', businessId)
            .eq('owner_id', user.id)
            .single()

        if (bizError || !business) {
            return NextResponse.json({ error: 'Negocio no encontrado o sin permisos' }, { status: 404 })
        }

        if (business.mp_pending_preapproval_id || business.mp_previous_preapproval_id) {
            return NextResponse.json({ error: 'Hay un cambio de plan en proceso. Esperá la confirmación o cancelalo antes de iniciar otro.' }, { status: 409 })
        }

        // Fallar antes de crear una suscripción externa si no podremos
        // persistirla para el webhook.
        const admin = createSupabaseAdmin()

        const suscripcion = await createPlanSubscription({
            business,
            planId,
            userEmail: user.email,
        })

        if (suscripcion.is_demo) {
            return NextResponse.json({ success: true, checkoutUrl: suscripcion.init_point, isDemo: true })
        }

        // Se guarda ANTES de mandar al checkout: si el dueño paga y no
        // tenemos el id, el webhook llega con una suscripción que no sabemos
        // de quién es.
        const { data: stored, error: updateError } = await admin
            .from('businesses')
            .update({ mp_pending_preapproval_id: suscripcion.id, mp_pending_plan_id: planId })
            .eq('id', business.id)
            .is('mp_pending_preapproval_id', null)
            .is('mp_previous_preapproval_id', null)
            .select('id')
            .maybeSingle()

        if (!stored || updateError) {
            try { await cancelSubscription(suscripcion.id) } catch (cancelError) {
                logError('subscribe/cancelar-huerfana', cancelError, { businessId })
            }
            logError('subscribe/guardar-id', updateError, { businessId })
            return NextResponse.json(
                { error: 'Ya hay un cambio en proceso o no se pudo guardar la suscripción.' },
                { status: stored ? 500 : 409 }
            )
        }

        return NextResponse.json({
            success: true,
            checkoutUrl: suscripcion.init_point,
            isDemo: suscripcion.is_demo || false,
        })
    } catch (err) {
        logError('api/mercadopago/subscribe', err)
        return NextResponse.json(
            { error: err.message || 'Error al procesar la suscripción' },
            { status: 500 }
        )
    }
}

/**
 * DELETE — da de baja la suscripción.
 *
 * No se le corta el servicio en el momento: los días ya pagados se conservan
 * hasta `plan_expires_at`. Cortar al instante sería cobrarle un mes y dejarlo
 * afuera el mismo día.
 */
export async function DELETE(request) {
    try {
        const cookieStore = await cookies()
        const supabase = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const businessId = searchParams.get('business_id')
        if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }

        const { data: business } = await supabase
            .from('businesses')
            .select('id, mp_preapproval_id, mp_pending_preapproval_id, mp_previous_preapproval_id')
            .eq('id', businessId)
            .eq('owner_id', user.id)
            .maybeSingle()

        if (!business) {
            return NextResponse.json({ error: 'Negocio no encontrado o sin permisos' }, { status: 404 })
        }
        if (!business.mp_preapproval_id && !business.mp_pending_preapproval_id && !business.mp_previous_preapproval_id) {
            return NextResponse.json({ error: 'No hay una suscripción activa' }, { status: 400 })
        }

        for (const id of [business.mp_preapproval_id, business.mp_pending_preapproval_id, business.mp_previous_preapproval_id]) {
            if (id && !id.startsWith('demo-')) await cancelSubscription(id)
        }

        const admin = createSupabaseAdmin()
        const { error: updateError } = await admin
            .from('businesses')
            .update({ plan_status: 'cancelled', mp_preapproval_id: null, mp_pending_preapproval_id: null, mp_pending_plan_id: null, mp_previous_preapproval_id: null })
            .eq('id', business.id)
        if (updateError) throw updateError

        return NextResponse.json({ success: true })
    } catch (err) {
        logError('api/mercadopago/subscribe DELETE', err)
        return NextResponse.json(
            { error: 'No se pudo cancelar la suscripción. Escribinos y lo resolvemos.' },
            { status: 500 }
        )
    }
}
