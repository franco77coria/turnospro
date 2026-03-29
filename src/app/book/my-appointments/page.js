'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { CalendarDays, Clock, MapPin, Check, X, RotateCcw, ArrowLeft, Store, History, AlertTriangle, Star } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import styles from './my-appointments.module.css'

function getCountdown(date, time) {
    const now = new Date()
    const apt = new Date(`${date}T${time}`)
    const diffMs = apt - now
    if (diffMs <= 0) return null

    const todayStr = now.toISOString().split('T')[0]
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0]

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

export default function MyAppointmentsPage() {
    const toast = useToast()
    const { user, loading: authLoading } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('upcoming')
    const [cancelling, setCancelling] = useState(null)
    const [cancelModal, setCancelModal] = useState(null) // { id, businessSettings }

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
            .select('id, name, address, phone, business_type, settings')
            .in('id', businessIds)

        const bizMap = {}
        businesses?.forEach(b => { bizMap[b.id] = b })

        setAppointments((appts || []).map(a => ({ ...a, business: bizMap[a.business_id] || null })))
        setLoading(false)
    }

    useEffect(() => {
        if (user) loadAppointments()
    }, [user])

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
            await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', cancelModal.id)
            setAppointments(prev => prev.map(a => a.id === cancelModal.id ? { ...a, status: 'cancelled' } : a))
            toast.success('Turno cancelado correctamente')
            setCancelModal(null)
        } catch (err) {
            console.error('Cancel error:', err)
            toast.error('Error al cancelar. Intentá de nuevo.')
        }
        setCancelling(null)
    }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    const filtered = appointments.filter(a => {
        if (filter === 'upcoming') return a.date >= today && a.status !== 'cancelled'
        if (filter === 'past') return new Date(`${a.date}T${a.time || '23:59'}`) < now && a.status !== 'cancelled'
        if (filter === 'cancelled') return a.status === 'cancelled'
        return true
    })

    const statusLabels = {
        confirmed: { label: 'Confirmado', color: '#16A34A', bg: '#F0FDF4' },
        pending:   { label: 'Pendiente',  color: '#D97706', bg: '#FFFBEB' },
        completed: { label: 'Completado', color: '#6366F1', bg: '#EEF2FF' },
        cancelled: { label: 'Cancelado',  color: '#DC2626', bg: '#FEF2F2' },
        no_show:   { label: 'No asistió', color: '#94A3B8', bg: '#F1F5F9' },
    }

    if (authLoading) return <div className={styles.page}><div className={styles.loadingWrap}><div className="loading-spinner" /></div></div>

    if (!user) {
        return (
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
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                {/* Header */}
                <div className={styles.header}>
                    <Link href="/book" className={styles.backBtn}><ArrowLeft size={16} /></Link>
                    <div>
                        <h1>Mis turnos</h1>
                        <p>Historial y próximos turnos</p>
                    </div>
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    {[
                        { key: 'upcoming', icon: <CalendarDays size={14} />, label: 'Próximos' },
                        { key: 'past',     icon: <History size={14} />,      label: 'Pasados' },
                        { key: 'cancelled',icon: <X size={14} />,            label: 'Cancelados' },
                    ].map(f => (
                        <button key={f.key} className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`} onClick={() => setFilter(f.key)}>
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                {loading ? (
                    <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>
                        <CalendarDays size={40} />
                        <h3>
                            {filter === 'upcoming' ? 'No tenés turnos próximos'
                                : filter === 'past' ? 'No tenés turnos pasados'
                                : 'No tenés turnos cancelados'}
                        </h3>
                        <p>Reservá un turno para empezar</p>
                        <Link href="/book" className="btn btn-primary">Explorar negocios</Link>
                    </div>
                ) : (
                    <div className={styles.appointmentList}>
                        {filtered.map(apt => {
                            const dateObj = new Date(apt.date + 'T12:00:00')
                            const status = statusLabels[apt.status] || statusLabels.pending
                            const canCancel = filter === 'upcoming' && apt.status !== 'cancelled'
                            const isPast = filter === 'past'
                            const countdown = filter === 'upcoming' ? getCountdown(apt.date, apt.time) : null
                            const endTime = apt.time ? getEndTime(apt.time, apt.duration) : null

                            return (
                                <div key={apt.id} className={styles.appointmentCard}>
                                    {/* Countdown banner for upcoming */}
                                    {countdown && (
                                        <div style={{
                                            background: 'var(--accent)',
                                            color: 'white',
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600,
                                            padding: '4px var(--space-4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--space-1)',
                                        }}>
                                            <Clock size={11} /> {countdown}
                                        </div>
                                    )}

                                    <div className={styles.appointmentTop}>
                                        <div className={styles.dateBlock}>
                                            <span className={styles.dateDay}>{dateObj.getDate()}</span>
                                            <span className={styles.dateMonth}>{dateObj.toLocaleDateString('es-AR', { month: 'short' })}</span>
                                        </div>
                                        <div className={styles.appointmentInfo}>
                                            <h3>{apt.service_name}</h3>
                                            <div className={styles.appointmentMeta}>
                                                <span>
                                                    <Clock size={12} />
                                                    {apt.time?.slice(0, 5)}{endTime ? ` – ${endTime}` : ''}
                                                </span>
                                                {apt.price != null && <span>${apt.price.toLocaleString()}</span>}
                                            </div>
                                            {apt.business && (
                                                <div className={styles.businessInfo}>
                                                    <Store size={12} />
                                                    <span>{apt.business.name}</span>
                                                    {apt.business.address && (
                                                        <><MapPin size={10} /><span className={styles.address}>{apt.business.address}</span></>
                                                    )}
                                                </div>
                                            )}
                                            {apt.notes && (
                                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
                                                    "{apt.notes}"
                                                </p>
                                            )}
                                        </div>
                                        <span className={styles.statusBadge} style={{ background: status.bg, color: status.color }}>
                                            {status.label}
                                        </span>
                                    </div>

                                    {(canCancel || isPast) && (
                                        <div className={styles.appointmentActions}>
                                            {canCancel && (
                                                <>
                                                    <Link href={`/book/${apt.business_id}`} className={styles.actionBtn}>
                                                        <RotateCcw size={13} /> Reprogramar
                                                    </Link>
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.cancelBtn}`}
                                                        onClick={() => tryCancel(apt.id, apt.business?.settings)}
                                                        disabled={cancelling === apt.id}
                                                    >
                                                        {cancelling === apt.id
                                                            ? <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                                                            : <><X size={13} /> Cancelar</>
                                                        }
                                                    </button>
                                                </>
                                            )}
                                            {isPast && apt.business_id && (
                                                <Link href={`/book/${apt.business_id}`} className={styles.actionBtn} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                                                    <RotateCcw size={13} /> Reservar de nuevo
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Cancel Modal */}
            {cancelModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-premium)' }}>
                        <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)' }}>
                                <AlertTriangle size={26} />
                            </div>
                            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>¿Cancelar este turno?</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                                El horario quedará libre para otros usuarios. Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <button onClick={() => setCancelModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                                Volver
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={cancelling === cancelModal.id}
                                style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-4)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
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
    )
}
