/**
 * Única fuente de verdad para la URL pública de la app.
 *
 * Antes cada archivo resolvía lo suyo y había cuatro respuestas distintas
 * conviviendo: 'https://glowup.com.ar' (dominio que no existe),
 * 'https://tu-glowup.com' (redirige 308 al www), 'https://www.tu-glowup.com'
 * y '' (que genera links relativos — inservibles dentro de un email).
 *
 * El dominio canónico es el WWW: el apex responde 308 hacia él. Apuntar al
 * apex hace que cada link de cada email pague un redirect de más, y que las
 * cookies puedan quedar en el host equivocado.
 */

const CANONICO = 'https://www.tu-glowup.com'

/** Normaliza: fuerza https, saca la barra final, y manda el apex al www. */
function normalizar(url) {
    if (!url || typeof url !== 'string') return null
    let u = url.trim().replace(/\/+$/, '')
    if (!u) return null
    if (u.startsWith('http://') && !u.includes('localhost') && !u.includes('127.0.0.1')) {
        u = u.replace(/^http:\/\//, 'https://')
    }
    if (!/^https?:\/\//.test(u)) u = `https://${u}`
    // El apex siempre redirige al www: evitamos el salto de más.
    u = u.replace(/^https:\/\/tu-glowup\.com/, CANONICO)
    return u
}

/**
 * URL base de la app, sin barra final.
 *
 * Ojo: NEXT_PUBLIC_APP_URL se congela en el bundle en tiempo de BUILD. Si en
 * Vercel apunta al dominio de vercel.app, TODO sale por ahí (emails, sitemap,
 * JSON-LD, back_urls de Mercado Pago) aunque el usuario haya entrado por el
 * dominio propio. Cambiar la variable exige redeploy para que surta efecto.
 */
export function appUrl() {
    return normalizar(process.env.NEXT_PUBLIC_APP_URL) || CANONICO
}

/** Construye una URL absoluta a partir de una ruta interna. */
export function absoluteUrl(path = '/') {
    const base = appUrl()
    if (!path) return base
    return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export const CANONICAL_URL = CANONICO
