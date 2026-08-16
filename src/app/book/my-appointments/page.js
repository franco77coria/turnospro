'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { CalendarDays, Clock, MapPin, X, RotateCcw, Store, History, AlertTriangle, Search, Calendar, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import {
    DEFAULT_DURATION,
    formatDateLocal,
    generateAvailableSlots,
    timeToMinutes,
    toOccupiedRanges,
    todayLocal,
} from '@/lib/scheduling'
import styles from './my-appointments.module.css'

function getCountdown(date, time) {
    const now = new Date()
    const apt = new Date(`${date}T${time}`)
    const diffMs = apt - now
    if (diffMs <= 0) return null

    const todayStr = formatDateLocal(now)
    const tomorrowStr = formatDateLocal(new Date(now.getTime() + 86400000))

    if (date === todayStr) {
        const mins = Math.floor(diffMs / 60000)
        if (mins < 60) return `En ${mins} min`
        return `Hoy a las ${time.slice(0, 5)}`
    }
    if (date === tomorrowStr) return 'Mañana'
    const days = Math.ceil(diffMs / 86400000)
    return `En ${days} días`
}

function getEndTime(time, duration) {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + (duration || 30)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Los horarios salen del mismo motor que usa la reserva y el dashboard.
// Antes esta pantalla tenía su propia lista fija de 09:00 a 19:30 cada 30 min,
// que ignoraba el horario de atención, la duración del servicio y el buffer.

export default function MyAppointmentsPage() {
    const toast = useToast()
    const { user, loading: authLoading } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [cancelling, setCancelling] = useState(null)
    const [cancelModal, setCancelModal] = useState(null)
    const [rescheduleModal, setRescheduleModal] = useState(null)

    async function loadAppointments() {
        if (!supabase || !user) { setLoading(false); return }

        const { data: clientRecords } = await supabase
            .from('clients')
            .select('id, business_id')
            .eq('email', user.email)

        if (!clientRecords?.length) {
            setAppointments([])
            setLoading(false)
            return
        }

        const clientIds = clientRecords.map(c => c.id)
        const businessIds = [...new Set(clientRecords.map(c => c.business_id))]

        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .in('client_id', clientIds)
            .order('date', { ascending: false })

        const { data: businesses } = await supabase
            .from('businesses')
            .select('id, name, slug, address, phone, business_type, settings, cover_image_url, logo_url')
            .in('id', businessIds)

        const bizMap = {}
        businesses?.forEach(b => { bizMap[b.id] = b })

        setAppointments((appts || []).map(a => ({ ...a, business: bizMap[a.business_id] || null })))
        setLoading(false)
    }

    useEffect(() => {
        if (user) loadAppointments()
    }, [user])

    async function openReschedule(apt) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = formatDateLocal(tomorrow)

        setRescheduleModal({
            appointment: apt,
            newDate: dateStr,
            newTime: '',
            slots: [],
            loadingSlots: true,
            saving: false,
        })

        fetchSlotsForDate(apt, dateStr)
    }

    async function fetchSlotsForDate(apt, dateStr) {
        try {
            // `public_busy_slots`: RLS no deja que un cliente lea los turnos de
            // otros, así que consultar `appointments` devolvía solo los propios
            // y todos los horarios aparecían libres.
            let query = supabase
                .from('public_busy_slots')
                .select('time, duration, team_member_id')
                .eq('business_id', apt.business_id)
                .eq('date', dateStr)
            if (apt.team_member_id) query = query.eq('team_member_id', apt.team_member_id)

            const { data: booked, error } = await query
            if (error) throw error

            const settings = apt.business?.settings || {}
            const available = generateAvailableSlots({
                settings,
                duration: apt.duration || DEFAULT_DURATION,
                // El turno propio no puede bloquearse a sí mismo.
                occupied: toOccupiedRanges(booked).filter(
                    o => !(dateStr === apt.date && o.startMin === timeToMinutes(apt.time))
                ),
                date: dateStr,
                enforceMinAdvance: true,
            })

            setRescheduleModal(prev => prev ? { ...prev, slots: available, loadingSlots: false } : null)
        } catch (err) {
            console.error('Error cargando horarios:', err)
            // Sin datos confiables no se inventan horarios: antes, si no quedaba
            // ninguno libre, se mostraba la lista completa como si lo estuvieran.
            setRescheduleModal(prev => prev ? { ...prev, slots: [], loadingSlots: false } : null)
        }
    }

    function handleRescheduleDateChange(newDate) {
        if (!rescheduleModal) return
        setRescheduleModal(prev => ({ ...prev, newDate, newTime: '', loadingSlots: true }))
        fetchSlotsForDate(rescheduleModal.appointment, newDate)
    }

    async function handleSaveReschedule() {
        if (!rescheduleModal || !rescheduleModal.newDate || !rescheduleModal.newTime) return

        setRescheduleModal(prev => ({ ...prev, saving: true }))
        try {
            const res = await fetch(`/api/appointments/${rescheduleModal.appointment.id}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: rescheduleModal.newDate,
                    time: rescheduleModal.newTime,
                })
            })

            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Error al reprogramar el turno')
                setRescheduleModal(prev => ({ ...prev, saving: false }))
                return
            }

            // Actualizar lista local
            setAppointments(prev => prev.map(a => a.id === rescheduleModal.appointment.id ? {
                ...a,
                date: rescheduleModal.newDate,
                time: rescheduleModal.newTime,
            } : a))

            toast.success('🎉 Turno reprogramado exitosamente. Se envió la confirmación por email.')
            setRescheduleModal(null)
        } catch (err) {
            console.error('Reschedule error:', err)
            toast.error('Error al reprogramar el turno')
            setRescheduleModal(prev => ({ ...prev, saving: false }))
        }
    }

    function tryCancel(appointmentId, businessSettings) {
        const minHours = businessSettings?.min_cancel_hours ?? 2
        const appointment = appointments.find(a => a.id === appointmentId)
        if (!appointment) return

        const hoursUntil = (new Date(`${appointment.date}T${appointment.time}`) - new Date()) / 3600000
        if (hoursUntil < minHours) {
            toast.error(`No podés cancelar con menos de ${minHours}h de anticipación. Contactá al negocio.`)
            return
        }

        setCancelModal({ id: appointmentId, businessSettings })
    }

    async function handleCancel() {
        if (!cancelModal) return
        setCancelling(cancelModal.id)
        try {
            // Vía API, no un UPDATE directo: el endpoint valida la antelación
            // mínima, avisa al negocio por mail, dispara la lista de espera y
            // registra la cancelación. Antes nada de eso pasaba, y si RLS
            // rechazaba el update igual se mostraba "cancelado correctamente".
            const res = await fetch('/api/appointments/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment_id: cancelModal.id }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || 'Error al cancelar. Intentá de nuevo.')
                setCancelling(null)
                return
            }
            setAppointments(prev => prev.map(a => a.id === cancelModal.id ? { ...a, status: 'cancelled' } : a))
            toast.success('Turno cancelado correctamente')
            setCancelModal(null)
        } catch (err) {
            console.error('Cancel error:', err)
            toast.error('Error al cancelar. Intentá de nuevo.')
        }
        setCancelling(null)
    }

    const today = todayLocal()
    const now = new Date()

    const filtered = appointments.filter(a => {
        if (filter === 'upcoming') return a.date >= today && a.status !== 'cancelled'
        if (filter === 'past') return new Date(`${a.date}T${a.time || '23:59'}`) < now && a.status !== 'cancelled'
        if (filter === 'cancelled') return a.status === 'cancelled'
        return true // 'all'
    })

    if (authLoading) return (
        <ConsumerLayout>
            <div className={styles.page}><div className={styles.loadingWrap}><div className="loading-spinner" /></div></div>
        </ConsumerLayout>
    )

    if (!user) {
        return (
            <ConsumerLayout>
                <div className={styles.page}>
                    <div className={styles.container}>
                        <div className={styles.authCard}>
                            <Store size={32} style={{ color: 'var(--accent)' }} />
                            <h2>Iniciá sesión para ver tus turnos</h2>
                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                <Link href="/login?redirect=/book/my-appointments" className="btn btn-primary">Iniciar sesión</Link>
                                <Link href="/register" className="btn btn-secondary">Crear cuenta</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </ConsumerLayout>
        )
    }

    return (
        <ConsumerLayout>
            <div className={styles.page}>
                <div className={styles.container}>
                    {/* Header — Booksy style */}
                    <div className={styles.header}>
                        <h1>Historial</h1>
                        <Link href="/explore" className={styles.searchBtn} aria-label="Buscar">
                            <Search size={20} />
                        </Link>
                    </div>

                    {/* Tabs */}
                    <div className={styles.filters}>
                        {[
                            { key: 'all', label: 'Todo' },
                            { key: 'upcoming', label: 'Citas' },
                            { key: 'past', label: 'Pasados' },
                            { key: 'cancelled', label: 'Cancelados' },
                        ].map(f => (
                            <button
                                key={f.key}
                                className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Section title */}
                    <h2 className={styles.listTitle}>Historial</h2>

                    {/* List */}
                    {loading ? (
                        <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                    ) : filtered.length === 0 ? (
                        <div className={styles.empty}>
                            <CalendarDays size={40} />
                            <h3>
                                {filter === 'upcoming' ? 'No tenés turnos próximos'
                                    : filter === 'past' ? 'No tenés turnos pasados'
                                    : filter === 'cancelled' ? 'No tenés turnos cancelados'
                                    : 'No tenés turnos aún'}
                            </h3>
                            <p>Reservá un turno para empezar</p>
                            <Link href="/book" className="btn btn-primary">Explorar negocios</Link>
                        </div>
                    ) : (
                        <div className={styles.appointmentList}>
                            {filtered.map(apt => {
                                const dateObj = new Date(apt.date + 'T12:00:00')
                                const dateStr = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                                const isUpcoming = apt.date >= today && apt.status !== 'cancelled'
                                const isPast = new Date(`${apt.date}T${apt.time || '23:59'}`) < now && apt.status !== 'cancelled'
                                const canCancel = isUpcoming
                                const countdown = isUpcoming ? getCountdown(apt.date, apt.time) : null
                                const biz = apt.business

                                return (
                                    <div key={apt.id} className={styles.appointmentCard}>
                                        {/* Countdown */}
                                        {countdown && (
                                            <div className={styles.countdownBanner}>
                                                <Clock size={11} /> {countdown}
                                            </div>
                                        )}
                                        <div className={styles.appointmentRow}>
                                            <div className={styles.aptThumb}>
                                                {biz?.cover_image_url || biz?.logo_url ? (
                                                    <img src={biz.cover_image_url || biz.logo_url} alt={biz.name} />
                                                ) : (
                                                    <span>{(biz?.name || '?')[0].toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className={styles.aptInfo}>
                                                <span className={styles.aptBizName}>{biz?.name || 'Negocio'}</span>
                                                <span className={styles.aptDate}>{dateStr}</span>
                                                <span className={styles.aptMeta}>
                                                    {apt.price != null && `$${Number(apt.price).toLocaleString()}`}
                                                    {apt.price != null && apt.service_name && ' · '}
                                                    {apt.service_name && '1 artíc…'}
                                                </span>
                                            </div>
                                            <div className={styles.aptAction}>
                                                {isUpcoming && (
                                                    <button
                                                        className={styles.rescheduleBtn}
                                                        onClick={() => openReschedule(apt)}
                                                    >
                                                        <Calendar size={13} /> Cambiar horario
                                                    </button>
                                                )}
                                                {(isPast || filter === 'all') && apt.status !== 'cancelled' && biz && (
                                                    <Link
                                                        href={biz.slug ? `/book/s/${biz.slug}` : `/book/${apt.business_id}`}
                                                        className={styles.rebookBtn}
                                                    >
                                                        Volver a reservar
                                                    </Link>
                                                )}
                                                {canCancel && (
                                                    <button
                                                        className={styles.cancelBtn}
                                                        onClick={() => tryCancel(apt.id, biz?.settings)}
                                                        disabled={cancelling === apt.id}
                                                    >
                                                        {cancelling === apt.id
                                                            ? <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                                                            : <><X size={13} /> Cancelar</>
                                                        }
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Reschedule Modal */}
                {rescheduleModal && (
                    <div className="modal-overlay">
                        <div className="modal" style={{ maxWidth: 440, padding: 'var(--space-5)' }}>
                            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                <h3 style={{ fontWeight: 700, margin: 0, fontSize: 'var(--font-size-md)' }}>Reprogramar Turno</h3>
                                <button onClick={() => setRescheduleModal(null)} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                                        {rescheduleModal.appointment.business?.name || 'Negocio'}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {rescheduleModal.appointment.service_name} — Horario actual: {rescheduleModal.appointment.date} a las {rescheduleModal.appointment.time} hs
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="label" style={{ fontSize: 'var(--font-size-xs)' }}>Seleccionar nueva fecha *</label>
                                    <input
                                        className="input"
                                        type="date"
                                        min={todayLocal()}
                                        value={rescheduleModal.newDate}
                                        onChange={e => handleRescheduleDateChange(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="label" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Seleccionar nuevo horario *</span>
                                        {rescheduleModal.newTime && (
                                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                                Seleccionado: {rescheduleModal.newTime} hs
                                            </span>
                                        )}
                                    </label>

                                    {rescheduleModal.loadingSlots ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                                            <RefreshCw size={14} className="spin" /> Buscando disponibilidad...
                                        </div>
                                    ) : (
                                        <div className={styles.slotGrid}>
                                            {rescheduleModal.slots.map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    className={`${styles.slotBtn} ${rescheduleModal.newTime === t ? styles.selectedSlot : ''}`}
                                                    onClick={() => setRescheduleModal(prev => ({ ...prev, newTime: t }))}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer" style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
                                <button onClick={() => setRescheduleModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveReschedule}
                                    disabled={!rescheduleModal.newDate || !rescheduleModal.newTime || rescheduleModal.saving}
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    {rescheduleModal.saving ? (
                                        <div className="loading-spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                    ) : (
                                        'Confirmar cambio'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cancel Modal */}
                {cancelModal && (
                    <div className="modal-overlay">
                        <div className="modal" style={{ maxWidth: 380 }}>
                            <div className="modal-body" style={{ textAlign: 'center' }}>
                                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)' }}>
                                    <AlertTriangle size={26} />
                                </div>
                                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>¿Cancelar este turno?</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                                    El horario quedará libre. Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setCancelModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Volver</button>
                                <button
                                    onClick={handleCancel}
                                    disabled={cancelling === cancelModal.id}
                                    className="btn btn-danger" style={{ flex: 1 }}
                                >
                                    {cancelling === cancelModal.id
                                        ? <div className="loading-spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                                        : <><X size={15} /> Sí, cancelar</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ConsumerLayout>
    )
}
