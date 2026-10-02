/**
 * Mensajes prearmados para que el negocio le escriba al cliente por WhatsApp
 * desde el turno.
 *
 * Viven acá y no dentro del componente porque los usan la lista de turnos y el
 * calendario, y porque un texto que sale a nombre del negocio merece un test.
 */

import { formatDateEs } from './scheduling'

export const CLIENT_MESSAGE_TEMPLATE_MAX_LENGTH = 600
export const DEFAULT_CLIENT_MESSAGE_TEMPLATE = 'Hola {cliente}! Te escribimos de {negocio}. Tenés turno para {servicio} el {fecha} a las {hora}. ¿Confirmás que venís?'
export const CLIENT_MESSAGE_TOKENS = [
    { token: '{cliente}', label: 'Nombre del cliente' },
    { token: '{negocio}', label: 'Nombre del negocio' },
    { token: '{servicio}', label: 'Servicio' },
    { token: '{fecha}', label: 'Fecha' },
    { token: '{hora}', label: 'Hora' },
]

/** Primer nombre, para que el saludo no quede acartonado. */
export function primerNombre(nombreCompleto) {
    if (!nombreCompleto || typeof nombreCompleto !== 'string') return ''
    return nombreCompleto.trim().split(/\s+/)[0] || ''
}

function encabezado(clientName, businessName) {
    const nombre = primerNombre(clientName)
    const hola = nombre ? `Hola ${nombre}!` : 'Hola!'
    return businessName ? `${hola} Te escribimos de ${businessName}.` : hola
}

/** Fecha en palabras; si no se puede parsear, se devuelve tal cual vino. */
function fechaLegible(date) {
    if (!date) return ''
    try {
        return formatDateEs(date, { weekday: 'long', day: 'numeric', month: 'long' })
    } catch {
        return String(date)
    }
}

/**
 * Reemplaza únicamente las variables documentadas. Las desconocidas quedan a
 * la vista para que el dueño pueda detectar el error en la previsualización.
 */
export function personalizarMensajeCliente(template, datos = {}) {
    const values = {
        cliente: primerNombre(datos.clientName),
        negocio: datos.businessName || '',
        servicio: datos.serviceName || 'tu turno',
        fecha: fechaLegible(datos.date),
        hora: (datos.time || '').slice(0, 5),
    }

    return String(template || '')
        .slice(0, CLIENT_MESSAGE_TEMPLATE_MAX_LENGTH)
        .replace(/\{(cliente|negocio|servicio|fecha|hora)\}/g, (_, key) => values[key])
        .replace(/[ \t]+([,.;!?])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
}

const TIPOS = {
    // El que más se usa: confirmar que el cliente va a venir.
    confirmar: (d) =>
        `${encabezado(d.clientName, d.businessName)} Tenés turno para ${d.serviceName} el ${fechaLegible(d.date)} a las ${d.time}. ¿Confirmás que venís?`,

    recordar: (d) =>
        `${encabezado(d.clientName, d.businessName)} Te recordamos tu turno de ${d.serviceName} el ${fechaLegible(d.date)} a las ${d.time}. ¡Te esperamos!`,

    reprogramar: (d) =>
        `${encabezado(d.clientName, d.businessName)} Necesitamos reprogramar tu turno de ${d.serviceName} del ${fechaLegible(d.date)} a las ${d.time}. ¿Qué otro horario te queda cómodo?`,

    llegando: (d) =>
        `${encabezado(d.clientName, d.businessName)} Te esperamos a las ${d.time} para tu ${d.serviceName}. ¿Estás en camino?`,

    // Sin contexto de turno: para escribirle a un cliente y nada más.
    libre: (d) => encabezado(d.clientName, d.businessName),
}

/**
 * @param {'confirmar'|'recordar'|'reprogramar'|'llegando'|'libre'} tipo
 * @param {{clientName?:string, businessName?:string, serviceName?:string, date?:string, time?:string}} datos
 * @returns {string}
 */
export function mensajeParaCliente(tipo, datos = {}, customTemplate = '') {
    const armar = TIPOS[tipo] || TIPOS.libre
    const d = {
        ...datos,
        serviceName: datos.serviceName || 'tu turno',
        time: (datos.time || '').slice(0, 5),
    }
    if (tipo === 'confirmar' && customTemplate?.trim()) {
        return personalizarMensajeCliente(customTemplate, d)
    }
    // Sin fecha ni hora, un mensaje de turno queda cojo: mejor el saludo simple.
    if (tipo !== 'libre' && (!d.date || !d.time)) return TIPOS.libre(d)
    return armar(d)
}

export const TIPOS_DE_MENSAJE = [
    { id: 'confirmar', etiqueta: 'Confirmar turno' },
    { id: 'recordar', etiqueta: 'Recordar turno' },
    { id: 'llegando', etiqueta: '¿Estás en camino?' },
    { id: 'reprogramar', etiqueta: 'Reprogramar' },
    { id: 'libre', etiqueta: 'Solo saludar' },
]
