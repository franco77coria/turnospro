/**
 * Validación de servidor para una solicitud de reserva.
 *
 * El formulario de reserva ya filtra horarios: solo ofrece los que entran en la
 * jornada, respetan la antelación mínima y no están ocupados. Pero eso es la
 * PANTALLA. `POST /api/appointments` se puede llamar con curl, y hasta ahora
 * aceptaba lo que viniera: un turno a las 3 de la mañana, un domingo cerrado,
 * con fecha del año pasado, con la duración que el cliente eligiera — y, lo más
 * caro, con el PRECIO que el cliente eligiera.
 *
 * Que la pantalla no lo muestre no es un control. El precio y la duración se
 * resuelven acá contra el catálogo del negocio; lo que mandó el cliente se
 * descarta.
 */

import { loadBusinessServices } from './services'
import {
    resolveScheduleSettings,
    timeToMinutes,
    formatDateLocal,
    DEFAULT_DURATION,
} from './scheduling'
import { nowInTimezone } from './timezone'
import { isBusinessClosed, isTeamMemberAbsent } from './availability'
import { planVigente } from './plan'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * @returns {Promise<{ ok: true, price: number, duration: number, serviceName: string }
 *                  | { ok: false, status: number, error: string }>}
 */
export async function validarReserva(supabase, {
    business_id,
    service_name,
    date,
    time,
    duration: duracionPedida,
    team_member_id,
    // El dashboard agenda a propósito fuera de la grilla (encaja a un cliente
    // en un hueco, agenda un feriado). Solo el staff autenticado puede pedirlo.
    permitirFueraDeHorario = false,
}) {
    const { data: business } = await supabase
        .from('businesses')
        .select('id, settings, timezone, plan_status, plan_expires_at')
        .eq('id', business_id)
        .maybeSingle()

    if (!business) {
        return { ok: false, status: 404, error: 'El negocio no existe' }
    }

    // Plan vencido: no se toman turnos nuevos. Se verifica acá y no solo en
    // la pantalla porque este endpoint se llama con curl.
    // El mensaje es neutro a propósito: el cliente del negocio no tiene por
    // qué enterarse de que su barbería no pagó la cuota.
    if (!planVigente(business)) {
        return {
            ok: false,
            status: 409,
            error: 'Este negocio no está recibiendo reservas en este momento.',
        }
    }

    // ── 1. El servicio tiene que existir en el catálogo del negocio ───────
    const servicios = await loadBusinessServices(supabase, business_id, { activeOnly: true })
    const servicio = servicios.find(
        (s) => s.name.trim().toLowerCase() === String(service_name).trim().toLowerCase()
    )

    if (!servicio) {
        return {
            ok: false,
            status: 400,
            error: 'Ese servicio no está disponible en este negocio',
        }
    }

    // El precio SIEMPRE sale del catálogo. Si el cliente manda price: 0 para un
    // corte de $15.000, se ignora: el turno queda con el precio real y las
    // comisiones del profesional se calculan sobre el monto correcto.
    const price = servicio.price
    const duration = servicio.duration || duracionPedida || DEFAULT_DURATION

    // ── 2. El profesional tiene que ser de este negocio ───────────────────
    if (team_member_id) {
        const { data: miembro } = await supabase
            .from('team_members')
            .select('id, active')
            .eq('id', team_member_id)
            .eq('business_id', business_id)
            .maybeSingle()

        if (!miembro || miembro.active === false) {
            return { ok: false, status: 400, error: 'El profesional elegido no está disponible' }
        }
    }

    if (permitirFueraDeHorario) {
        return { ok: true, price, duration, serviceName: servicio.name }
    }

    // ── 3. Reglas de calendario ───────────────────────────────────────────
    const cfg = resolveScheduleSettings(business.settings, date)
    const tz = business.timezone || undefined
    const ahora = nowInTimezone(tz)

    // La fecha se compara en la zona del negocio, no en UTC: con toISOString()
    // en un servidor UTC, a partir de las 21:00 en Argentina "hoy" ya es mañana.
    const [y, m, d] = String(date).split('-').map(Number)
    const inicioTurno = new Date(y, m - 1, d, 0, 0, 0)
    inicioTurno.setMinutes(timeToMinutes(time))

    if (inicioTurno <= ahora) {
        return { ok: false, status: 400, error: 'No se puede reservar un turno en el pasado' }
    }

    const horasDeAntelacion = (inicioTurno - ahora) / 36e5
    if (horasDeAntelacion < cfg.minAdvanceHours) {
        return {
            ok: false,
            status: 400,
            error: `Hay que reservar con al menos ${cfg.minAdvanceHours} h de anticipación`,
        }
    }

    const diasDeAnticipacion = (inicioTurno - ahora) / 864e5
    if (cfg.maxAdvanceDays > 0 && diasDeAnticipacion > cfg.maxAdvanceDays) {
        return {
            ok: false,
            status: 400,
            error: `No se puede reservar con más de ${cfg.maxAdvanceDays} días de anticipación`,
        }
    }

    const diaSemana = inicioTurno.getDay()
    if (!cfg.workDays.includes(diaSemana)) {
        return { ok: false, status: 400, error: `El negocio no atiende los ${DIAS[diaSemana]}` }
    }

    const inicioMin = timeToMinutes(time)
    if (inicioMin < cfg.startMin || inicioMin + duration > cfg.endMin) {
        return {
            ok: false,
            status: 400,
            error: 'Ese horario está fuera del horario de atención',
        }
    }

    // ── 4. Feriados y licencias ───────────────────────────────────────────
    const fecha = formatDateLocal(inicioTurno)

    if (await isBusinessClosed(supabase, business_id, fecha)) {
        return { ok: false, status: 400, error: 'El negocio está cerrado ese día' }
    }

    if (team_member_id && await isTeamMemberAbsent(supabase, team_member_id, business_id, fecha)) {
        return { ok: false, status: 400, error: 'El profesional no trabaja ese día' }
    }

    return { ok: true, price, duration, serviceName: servicio.name }
}
