/**
 * Utilidades para el manejo y formateo de visitas de clientes.
 */

/**
 * Retorna la etiqueta formateada de visitas (ej: "1 visita", "4 visitas").
 * Retorna null si no tiene visitas o es 0.
 * 
 * @param {number|null|undefined} totalVisits
 * @returns {string|null}
 */
export function formatVisitsLabel(totalVisits) {
    const count = parseInt(totalVisits, 10)
    if (isNaN(count) || count <= 0) return null
    return count === 1 ? '1 visita' : `${count} visitas`
}

/**
 * Determina si un cliente es recurrente (más de una visita).
 * 
 * @param {number|null|undefined} totalVisits 
 * @returns {boolean}
 */
export function isRecurringClient(totalVisits) {
    const count = parseInt(totalVisits, 10)
    return !isNaN(count) && count > 1
}
