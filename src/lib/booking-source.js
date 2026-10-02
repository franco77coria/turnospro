export const BOOKING_SOURCES = ['direct', 'search', 'map', 'flyer']

export const BOOKING_SOURCE_LABELS = {
    direct: 'Acceso directo',
    search: 'Buscador',
    map: 'Mapa',
    flyer: 'Flyer',
}

export function normalizeBookingSource(value) {
    return BOOKING_SOURCES.includes(value) ? value : 'direct'
}

export function withBookingSource(href, source, extra = {}) {
    const normalized = normalizeBookingSource(source)
    const [path, rawQuery = ''] = String(href || '').split('?')
    const params = new URLSearchParams(rawQuery)
    if (normalized !== 'direct') params.set('source', normalized)
    for (const [key, value] of Object.entries(extra)) {
        if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
    }
    const query = params.toString()
    return query ? `${path}?${query}` : path
}
