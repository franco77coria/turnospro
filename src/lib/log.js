/**
 * Logging con redacción de datos personales.
 *
 * Los logs de la app van a parar a Vercel, donde quedan guardados y son
 * legibles por cualquiera con acceso al panel. El flujo de reservas venía
 * escribiendo ahí el email, el teléfono y el nombre de cada cliente en texto
 * plano — es la base de clientes del negocio, replicada en los logs.
 *
 * Estas funciones dejan pasar lo que sirve para diagnosticar (¿había email?,
 * ¿de qué dominio?) sin escribir el dato en sí.
 */

/** `ana.perez@gmail.com` → `a***@gmail.com`. Alcanza para diagnosticar. */
export function maskEmail(email) {
    if (!email || typeof email !== 'string') return '(sin email)'
    const [user, domain] = email.split('@')
    if (!domain) return '(email inválido)'
    return `${user.slice(0, 1)}***@${domain}`
}

/** `+5491168727107` → `+54*****7107`. Conserva país y últimos 4. */
export function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '(sin teléfono)'
    const clean = phone.replace(/[^\d+]/g, '')
    if (clean.length < 6) return '***'
    return `${clean.slice(0, 3)}*****${clean.slice(-4)}`
}

/** Un nombre propio no aporta nada al diagnóstico: solo si vino o no. */
export function maskName(name) {
    if (!name || typeof name !== 'string') return '(sin nombre)'
    return `${name.trim().slice(0, 1)}. (${name.trim().length} car.)`
}

const CLAVES_SENSIBLES = /^(email|phone|telefono|name|full_name|nombre|password|token|secret|key|authorization|apikey|client_email|guest_email|guest_phone|guest_name)$/i

/** Redacta un objeto antes de logearlo. No recursa más de lo necesario. */
export function redact(value, depth = 0) {
    if (value == null || depth > 3) return value
    if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v, depth + 1))
    if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value
    if (typeof value !== 'object') return value

    const out = {}
    for (const [k, v] of Object.entries(value)) {
        if (!CLAVES_SENSIBLES.test(k)) {
            out[k] = redact(v, depth + 1)
            continue
        }
        if (typeof v !== 'string') { out[k] = v ? '[redactado]' : v; continue }
        if (/email/i.test(k)) out[k] = maskEmail(v)
        else if (/phone|telefono/i.test(k)) out[k] = maskPhone(v)
        else if (/name|nombre/i.test(k)) out[k] = maskName(v)
        else out[k] = '[redactado]'
    }
    return out
}

/** Log de error con metadatos redactados. */
export function logError(tag, err, meta) {
    const detalle = err instanceof Error ? err.message : String(err ?? '')
    if (meta === undefined) console.error(`[${tag}]`, detalle)
    else console.error(`[${tag}]`, detalle, redact(meta))
}

/** Log informativo con metadatos redactados. */
export function logInfo(tag, mensaje, meta) {
    if (meta === undefined) console.log(`[${tag}]`, mensaje)
    else console.log(`[${tag}]`, mensaje, redact(meta))
}
