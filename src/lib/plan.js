/**
 * Vigencia del plan de un negocio.
 *
 * Hasta acá `plan_expires_at` no se verificaba en ningún lado: un negocio con
 * el plan vencido hacía seis meses seguía usando todo. La suscripción era
 * decorativa.
 *
 * El corte es inmediato al vencimiento, sin días de gracia. Es una decisión
 * de negocio tomada a conciencia: la contrapartida es que un problema con la
 * tarjeta (vencida, sin límite) deja al negocio afuera sin margen, así que
 * los avisos previos —que llegan por email y en el panel— son la única red.
 *
 * Se corta también la ficha pública de reserva. Dejarla viva mientras el
 * panel está bloqueado sería peor: le seguirían entrando turnos que no puede
 * ver, y los clientes llegarían al local sin que nadie los espere.
 */

/** Estados en los que el negocio puede operar. */
const ESTADOS_HABILITADOS = new Set(['active', 'trialing', 'cancelled', 'paused'])

/**
 * ¿El negocio puede operar?
 *
 * `cancelled` y `paused` siguen habilitados: dar de baja no quita los días ya
 * pagados. Lo que manda es la fecha, no el estado.
 *
 * @param {{plan_status?: string, plan_expires_at?: string}|null} business
 * @param {Date} [ahora]
 */
export function planVigente(business, ahora = new Date()) {
    if (!business) return false

    const estado = business.plan_status || 'trialing'
    if (!ESTADOS_HABILITADOS.has(estado)) return false

    // Sin fecha de vencimiento no se bloquea: es un negocio viejo anterior a
    // este campo, y cortarle el servicio por un dato que nunca tuvo sería
    // un error nuestro, no una falta de pago suya.
    if (!business.plan_expires_at) return true

    const vence = new Date(business.plan_expires_at)
    if (Number.isNaN(vence.getTime())) return true

    return vence > ahora
}

/** Días que faltan para el vencimiento. Negativo si ya venció. */
export function diasParaVencer(business, ahora = new Date()) {
    if (!business?.plan_expires_at) return null
    const vence = new Date(business.plan_expires_at)
    if (Number.isNaN(vence.getTime())) return null
    return Math.ceil((vence.getTime() - ahora.getTime()) / 86400000)
}

/**
 * Rutas del panel que siguen abiertas con el plan vencido.
 * Tiene que poder pagar y tiene que poder irse con sus datos: bloquear la
 * pantalla de suscripción dejaría al negocio sin forma de reactivarse.
 */
export const RUTAS_SIN_PLAN = [
    '/dashboard/subscription',
    '/dashboard/settings',
]

export function rutaPermitidaSinPlan(pathname) {
    if (!pathname) return false
    return RUTAS_SIN_PLAN.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}
