// Helper de integración con Mercado Pago para Suscripciones SaaS B2B de TurnosPro
import { appUrl as getAppUrl } from '@/lib/app-url'

export const PLANS = {
    pro: {
        id: 'pro',
        name: 'Plan Pro',
        price: 20000,
        currency: 'ARS',
        maxLocations: 1,
        description: '1 Sucursal con TODAS las funcionalidades habilitadas.',
        features: [
            '1 Sucursal',
            'Agenda online 24/7 y turnos ilimitados',
            'Gestión de clientes y CRM con historial',
            'Control de inventario y stock de productos',
            'Sistema de comisiones de personal',
            'Caja diaria y finanzas completas',
            'Contacto por email con mensajes prearmados',
            'Notificaciones por Email',
            'Generador de flyers para redes sociales',
        ]
    },
    multi: {
        id: 'multi',
        name: 'Plan Múltiples Sucursales',
        price: 35000,
        currency: 'ARS',
        maxLocations: 3,
        description: 'Hasta 3 sucursales con todas las funciones pro de la plataforma.',
        features: [
            'Hasta 3 Sucursales',
            'Todas las funcionalidades Pro habilitadas',
            'Gestión unificada de equipo por sede',
            'Inventario y caja por sucursal',
            'CRM y reportes consolidados',
            'Notificaciones por Email',
            'Soporte prioritario 24/7',
        ]
    },
    custom: {
        id: 'custom',
        name: 'Plan Personalizado',
        price: 0,
        currency: 'ARS',
        maxLocations: 999,
        description: 'Para cadenas y más de 3 sucursales. Asesoramiento dedicado.',
        features: [
            'Más de 3 Sucursales',
            'Funcionalidades y módulos a medida',
            'Capacitación dedicada para tu equipo',
            'Integraciones personalizadas',
            'Soporte directo exclusivo',
        ]
    },
    base: {
        id: 'base',
        name: 'Plan Pro',
        price: 20000,
        currency: 'ARS',
        maxLocations: 1,
        description: '1 Sucursal con TODAS las funcionalidades habilitadas.',
        features: [
            '1 Sucursal',
            'Agenda online 24/7 y turnos ilimitados',
            'Gestión de clientes y CRM con historial',
            'Control de inventario y stock de productos',
            'Sistema de comisiones de personal',
            'Caja diaria y finanzas completas',
            'Contacto por email con mensajes prearmados',
            'Notificaciones por Email',
        ]
    }
}

/**
 * Crea una preferencia de Checkout Pro en Mercado Pago para la suscripción de un negocio.
 */
export async function createPlanPreference({ business, planId, userEmail }) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const plan = PLANS[planId]

    if (!plan || planId === 'custom') {
        throw new Error('Plan no válido para checkout automático')
    }

    const appUrl = getAppUrl()

    // Si no está configurado el Access Token de Mercado Pago, devolvemos un link simulado o lanzamos error claro
    if (!accessToken) {
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
            throw new Error('Mercado Pago no está configurado')
        }
        console.warn('⚠️ MERCADOPAGO_ACCESS_TOKEN no configurado en entorno')
    }

    const preferenceBody = {
        items: [
            {
                id: `subscription-${plan.id}`,
                title: `TurnosPro - ${plan.name} (Suscripción Mensual)`,
                description: plan.description,
                quantity: 1,
                currency_id: 'ARS',
                unit_price: Number(plan.price),
            }
        ],
        payer: {
            email: userEmail || 'dueno@negocio.com',
            name: business.name || 'Dueño TurnosPro',
        },
        external_reference: JSON.stringify({
            business_id: business.id,
            plan_id: plan.id,
            max_locations: plan.maxLocations,
        }),
        back_urls: {
            success: `${appUrl}/dashboard/subscription?status=success&plan=${plan.id}`,
            failure: `${appUrl}/dashboard/subscription?status=failure`,
            pending: `${appUrl}/dashboard/subscription?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mercadopago/webhook`,
    }

    if (!accessToken) {
        // Retornar fallback para ambiente de desarrollo/demostración
        return {
            id: `demo-pref-${Date.now()}`,
            init_point: `${appUrl}/dashboard/subscription?status=demo_success&plan=${plan.id}`,
            sandbox_init_point: `${appUrl}/dashboard/subscription?status=demo_success&plan=${plan.id}`,
            is_demo: true,
        }
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(preferenceBody)
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Mercado Pago API error:', errorData)
        throw new Error(errorData.message || 'Error al conectar con Mercado Pago')
    }

    const data = await response.json()
    return {
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
    }
}

/**
 * Crea una SUSCRIPCIÓN de verdad (débito automático mensual).
 *
 * Antes se cobraba con una preferencia de Checkout Pro: un pago único al que
 * el webhook le sumaba 30 días. Eso no es una suscripción, es una recarga
 * manual — al mes siguiente el dueño tiene que acordarse de pagar de nuevo, y
 * si se olvida se le corta el servicio.
 *
 * Acá se usa la API de preapproval con `status: "pending"`: Mercado Pago
 * devuelve un `init_point` donde el dueño carga la tarjeta. La tarjeta nunca
 * pasa por nuestro servidor, así que no cargamos con PCI. Una vez autorizada,
 * Mercado Pago cobra solo cada mes y avisa por webhook.
 *
 * @returns {Promise<{id:string, init_point:string, is_demo?:boolean}>}
 */
export async function createPlanSubscription({ business, planId, userEmail }) {
    const plan = PLANS[planId]
    if (!plan || planId === 'custom') {
        throw new Error('Plan no válido para suscripción automática')
    }
    if (!userEmail) {
        throw new Error('Falta el email del titular de la suscripción')
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const appUrl = getAppUrl()

    // Sin token no se puede cobrar. En desarrollo devolvemos un link simulado
    // para poder recorrer la pantalla; en producción esto no debería pasar.
    if (!accessToken) {
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
            throw new Error('Mercado Pago no está configurado')
        }
        console.warn('MERCADOPAGO_ACCESS_TOKEN no configurado')
        return {
            id: `demo-sub-${Date.now()}`,
            init_point: `${appUrl}/dashboard/subscription?status=demo_success&plan=${plan.id}`,
            is_demo: true,
        }
    }

    const cuerpo = {
        reason: `GLOWUP — ${plan.name}`,
        // Lo lee el webhook para saber a qué negocio corresponde el cobro.
        external_reference: JSON.stringify({ business_id: business.id, plan_id: plan.id }),
        payer_email: userEmail,
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: Number(plan.price),
            currency_id: 'ARS',
        },
        back_url: `${appUrl}/dashboard/subscription?status=suscripto`,
        status: 'pending',
    }

    const res = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(cuerpo),
    })

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('Mercado Pago preapproval error:', error)
        throw new Error(error.message || 'No se pudo crear la suscripción')
    }

    const data = await res.json()
    return { id: data.id, init_point: data.init_point, status: data.status }
}

/** Consulta el estado de una suscripción. */
export async function getSubscription(preapprovalId) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('No se pudo consultar la suscripción')
    return res.json()
}

/**
 * Cancela una suscripción. El dueño deja de pagar desde el próximo ciclo;
 * los días que ya pagó los conserva, así que NO se le corta el servicio acá.
 */
export async function cancelSubscription(preapprovalId) {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')

    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
    })

    if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        console.error('Mercado Pago cancel error:', error)
        throw new Error(error.message || 'No se pudo cancelar la suscripción')
    }
    return res.json()
}
