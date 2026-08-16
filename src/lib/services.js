/**
 * Única fuente de verdad para los servicios de un negocio.
 *
 * Históricamente convivían dos: la tabla `services` (donde escribe la pantalla
 * de Servicios) y `businesses.services` (JSONB, donde escribía el onboarding).
 * El calendario leía el JSONB y la reserva pública la tabla, así que la duración
 * que cargaba el dueño no llegaba al dashboard. Todas las pantallas llaman acá.
 */

import { DEFAULT_DURATION } from './scheduling'

/** Deja cualquier origen (tabla o JSONB viejo) con la misma forma. */
export function normalizeService(raw, index = 0) {
    if (!raw) return null
    const duration = parseInt(raw.duration, 10)
    const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price)
    return {
        id: raw.id || `legacy-${index}-${raw.name}`,
        name: raw.name || '',
        duration: Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION,
        price: Number.isFinite(price) ? price : 0,
        category: raw.category || null,
        description: raw.description || null,
        active: raw.active !== false,
        sort_order: Number.isFinite(parseInt(raw.sort_order, 10)) ? parseInt(raw.sort_order, 10) : index,
        // Marca los que todavía viven en el JSONB y no fueron migrados.
        legacy: !raw.id,
    }
}

/**
 * Carga los servicios del negocio: primero la tabla, y solo si está vacía
 * cae al JSONB para no romper negocios que todavía no migraron.
 *
 * @param {object} supabase cliente de supabase
 * @param {string} businessId
 * @param {{ activeOnly?: boolean }} options
 * @returns {Promise<Array>} servicios normalizados
 */
export async function loadBusinessServices(supabase, businessId, { activeOnly = false } = {}) {
    if (!supabase || !businessId) return []

    let query = supabase
        .from('services')
        .select('*')
        .eq('business_id', businessId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

    if (activeOnly) query = query.eq('active', true)

    const { data, error } = await query

    if (!error && data?.length > 0) {
        return data.map(normalizeService).filter(Boolean)
    }

    // Fallback: negocio sin migrar todavía.
    const { data: biz } = await supabase
        .from('businesses')
        .select('services')
        .eq('id', businessId)
        .maybeSingle()

    const legacy = Array.isArray(biz?.services) ? biz.services : []
    return legacy
        .map(normalizeService)
        .filter(Boolean)
        .filter(s => !activeOnly || s.active)
}

/** Busca un servicio por nombre (así es como se guarda en el turno). */
export function findServiceByName(services, name) {
    if (!name) return null
    const target = String(name).trim().toLowerCase()
    return (services || []).find(s => s.name?.trim().toLowerCase() === target) || null
}

/**
 * Duración a usar para un turno: la del servicio, o la guardada en el turno.
 * Nunca devuelve 0 ni NaN.
 */
export function resolveDuration(service, fallback = DEFAULT_DURATION) {
    const d = parseInt(service?.duration, 10)
    if (Number.isFinite(d) && d > 0) return d
    const f = parseInt(fallback, 10)
    return Number.isFinite(f) && f > 0 ? f : DEFAULT_DURATION
}
