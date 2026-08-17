/**
 * Redes sociales del negocio.
 *
 * Se guardan en `businesses.settings.socials` como el usuario las escribió, y
 * se normalizan al leer. Un dueño va a pegar cualquiera de estas formas:
 *   @barone.barber · barone.barber · instagram.com/barone.barber
 *   https://www.instagram.com/barone.barber/?igshid=xxxx
 * Todas tienen que terminar en el mismo link.
 */

export const SOCIAL_NETWORKS = [
    {
        id: 'instagram',
        label: 'Instagram',
        base: 'https://instagram.com/',
        // instagram.com y su versión con www, con o sin protocolo
        hostPattern: /(?:^|\.)instagram\.com$/i,
        placeholder: '@tunegocio',
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        base: 'https://tiktok.com/@',
        hostPattern: /(?:^|\.)tiktok\.com$/i,
        // TikTok lleva la arroba dentro de la ruta
        atInPath: true,
        placeholder: '@tunegocio',
    },
    {
        id: 'facebook',
        label: 'Facebook',
        base: 'https://facebook.com/',
        hostPattern: /(?:^|\.)facebook\.com$/i,
        placeholder: 'tunegocio',
    },
]

const BY_ID = Object.fromEntries(SOCIAL_NETWORKS.map(n => [n.id, n]))

/** Deja solo el nombre de usuario, venga como venga. */
function extractHandle(network, raw) {
    let value = String(raw || '').trim()
    if (!value) return null

    // Si trae dominio, se queda con el primer tramo de la ruta.
    const looksLikeUrl = /^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}\//i.test(value)
    if (looksLikeUrl) {
        let url
        try {
            url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
        } catch {
            return null
        }
        // Un link de otra red pegado en el campo equivocado no se acepta.
        if (!network.hostPattern.test(url.hostname)) return null
        value = url.pathname.split('/').filter(Boolean)[0] || ''
    }

    value = value.replace(/^@+/, '').trim()
    // Los caracteres válidos de un usuario en las tres redes.
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(value)) return null
    return value
}

/**
 * @returns {{ id, label, url, handle } | null}
 */
export function normalizeSocial(networkId, raw) {
    const network = BY_ID[networkId]
    if (!network) return null
    const handle = extractHandle(network, raw)
    if (!handle) return null
    return {
        id: network.id,
        label: network.label,
        handle,
        url: `${network.base}${handle}`,
    }
}

/** Todas las redes cargadas de un negocio, en orden fijo. */
export function resolveSocialLinks(settings) {
    const stored = settings?.socials || {}
    return SOCIAL_NETWORKS
        .map(n => normalizeSocial(n.id, stored[n.id]))
        .filter(Boolean)
}

/**
 * Guarda lo que escribió el dueño, descartando lo que no se puede interpretar.
 * @returns {{ socials: object, invalid: string[] }}
 */
export function serializeSocials(input) {
    const socials = {}
    const invalid = []
    for (const network of SOCIAL_NETWORKS) {
        const raw = String(input?.[network.id] || '').trim()
        if (!raw) continue
        const parsed = normalizeSocial(network.id, raw)
        if (parsed) socials[network.id] = parsed.handle
        else invalid.push(network.label)
    }
    return { socials, invalid }
}
