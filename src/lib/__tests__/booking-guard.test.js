import { describe, it, expect } from 'vitest'
import { validarReserva } from '../booking-guard'

// Supabase falso: devuelve filas fijas por tabla y soporta el encadenado de
// PostgREST (.select().eq().maybeSingle(), etc.).
function fakeSupabase({ business, services = [], teamMembers = [], closures = [], absences = [] }) {
    const porTabla = {
        businesses: business ? [business] : [],
        services,
        team_members: teamMembers,
        business_closures: closures,
        team_absences: absences,
    }

    const make = (tabla) => {
        let filas = [...(porTabla[tabla] || [])]
        const chain = {
            select: () => chain,
            eq: (col, val) => { filas = filas.filter((r) => r[col] === val); return chain },
            lte: () => chain,
            gte: () => chain,
            order: () => chain,
            limit: (n) => { filas = filas.slice(0, n); return chain },
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            single: async () => ({ data: filas[0] ?? null, error: null }),
            then: (res) => res({ data: filas, error: null }),
        }
        return chain
    }
    return { from: (t) => make(t) }
}

// Un martes bien en el futuro, para que nunca caiga en el pasado.
function fechaFutura(diasAdelante = 7) {
    const d = new Date()
    d.setDate(d.getDate() + diasAdelante)
    while (d.getDay() !== 2) d.setDate(d.getDate() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NEGOCIO = {
    id: 'biz-1',
    timezone: 'America/Argentina/Buenos_Aires',
    settings: {
        work_days: [1, 2, 3, 4, 5],
        work_hours: { start: '09:00', end: '18:00' },
        min_advance_hours: 0,
        max_advance_days: 60,
    },
}

const CORTE = { id: 'svc-1', business_id: 'biz-1', name: 'Corte', duration: 30, price: 15000, active: true }

const base = (over = {}) => ({
    business_id: 'biz-1',
    service_name: 'Corte',
    date: fechaFutura(),
    time: '10:00',
    duration: 30,
    ...over,
})

describe('validarReserva — el precio lo fija el catálogo', () => {
    it('ignora el precio que manda el cliente y usa el del servicio', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base())
        expect(r.ok).toBe(true)
        // El cliente podría mandar price: 0 — acá no se lee siquiera.
        expect(r.price).toBe(15000)
    })

    it('usa la duración del catálogo, no la del pedido', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ duration: 5 }))
        expect(r.duration).toBe(30)
    })

    it('rechaza un servicio que el negocio no ofrece', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ service_name: 'Servicio Inventado' }))
        expect(r.ok).toBe(false)
        expect(r.status).toBe(400)
    })

    it('compara el nombre del servicio sin distinguir mayúsculas ni espacios', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ service_name: '  corte  ' }))
        expect(r.ok).toBe(true)
    })
})

describe('validarReserva — reglas de calendario', () => {
    it('rechaza una fecha pasada', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ date: '2020-01-07' }))
        expect(r.ok).toBe(false)
        expect(r.error).toMatch(/pasado/i)
    })

    it('rechaza un horario fuera de la jornada', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ time: '03:00' }))
        expect(r.ok).toBe(false)
        expect(r.error).toMatch(/horario de atención/i)
    })

    it('rechaza un turno que termina después del cierre', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ time: '17:45' }))
        expect(r.ok).toBe(false)
    })

    it('rechaza un día en que el negocio no atiende', async () => {
        const db = fakeSupabase({
            business: { ...NEGOCIO, settings: { ...NEGOCIO.settings, work_days: [1] } },
            services: [CORTE],
        })
        const r = await validarReserva(db, base())  // es martes
        expect(r.ok).toBe(false)
        expect(r.error).toMatch(/no atiende/i)
    })

    it('respeta la antelación mínima', async () => {
        const db = fakeSupabase({
            business: { ...NEGOCIO, settings: { ...NEGOCIO.settings, min_advance_hours: 48 } },
            services: [CORTE],
        })
        const hoy = new Date()
        hoy.setHours(hoy.getHours() + 1)
        const r = await validarReserva(db, base({
            date: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`,
            time: '10:00',
        }))
        expect(r.ok).toBe(false)
    })

    it('rechaza reservar más allá del máximo de anticipación', async () => {
        const db = fakeSupabase({
            business: { ...NEGOCIO, settings: { ...NEGOCIO.settings, max_advance_days: 7 } },
            services: [CORTE],
        })
        const r = await validarReserva(db, base({ date: fechaFutura(60) }))
        expect(r.ok).toBe(false)
        expect(r.error).toMatch(/anticipación/i)
    })
})

describe('validarReserva — profesional', () => {
    it('rechaza un profesional de otro negocio', async () => {
        const db = fakeSupabase({
            business: NEGOCIO,
            services: [CORTE],
            teamMembers: [{ id: 'tm-1', business_id: 'otro-biz', active: true }],
        })
        const r = await validarReserva(db, base({ team_member_id: 'tm-1' }))
        expect(r.ok).toBe(false)
    })

    it('rechaza un profesional dado de baja', async () => {
        const db = fakeSupabase({
            business: NEGOCIO,
            services: [CORTE],
            teamMembers: [{ id: 'tm-1', business_id: 'biz-1', active: false }],
        })
        const r = await validarReserva(db, base({ team_member_id: 'tm-1' }))
        expect(r.ok).toBe(false)
    })
})

describe('validarReserva — excepción del staff', () => {
    it('el staff puede agendar fuera de la grilla, pero sigue pagando el precio real', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ time: '03:00', permitirFueraDeHorario: true }))
        expect(r.ok).toBe(true)
        expect(r.price).toBe(15000)
    })

    it('ni siquiera el staff puede reservar un servicio inexistente', async () => {
        const db = fakeSupabase({ business: NEGOCIO, services: [CORTE] })
        const r = await validarReserva(db, base({ service_name: 'Fantasma', permitirFueraDeHorario: true }))
        expect(r.ok).toBe(false)
    })
})

describe('validarReserva — negocio inexistente', () => {
    it('no revienta si el business_id no existe', async () => {
        const db = fakeSupabase({ business: null })
        const r = await validarReserva(db, base())
        expect(r.ok).toBe(false)
        expect(r.status).toBe(404)
    })
})
