// Helper de integración con Mercado Pago para Suscripciones SaaS B2B de TurnosPro

export const PLANS = {
    base: {
        id: 'base',
        name: 'Plan Base',
        price: 15000,
        currency: 'ARS',
        maxLocations: 1,
        description: '1 Sucursal, agenda online 24/7, clientes y gestión de caja básica.',
        features: [
            '1 Sucursal',
            'Agenda online 24/7',
            'Turnos ilimitados',
            'Gestión básica de clientes',
            'Gestión de caja diaria',
            'Notificaciones por Email',
        ]
    },
    pro: {
        id: 'pro',
        name: 'Plan Pro',
        price: 20000,
        currency: 'ARS',
        maxLocations: 1,
        description: '1 Sucursal con TODAS las funcionalidades avanzadas habilitadas.',
        features: [
            '1 Sucursal',
            'Todas las funciones del Plan Base',
            'Comisiones de personal y equipo',
            'Control de inventario y stock',
            'CRM avanzado y fidelización',
            'Reportes financieros y métricas completas',
            'Notificaciones por Email',
        ]
    },
    multi: {
        id: 'multi',
        name: 'Plan Múltiples Sucursales',
        price: 30000,
        currency: 'ARS',
        maxLocations: 3,
        description: 'Hasta 3 sucursales con todas las funciones pro de la plataforma.',
        features: [
            'Hasta 3 Sucursales',
            'Todas las funcionalidades Pro habilitadas',
            'Gestión unificada de equipo por sede',
            'CRM y reportes consolidados por sucursal',
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tu-glowup.com'

    // Si no está configurado el Access Token de Mercado Pago, devolvemos un link simulado o lanzamos error claro
    if (!accessToken) {
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
