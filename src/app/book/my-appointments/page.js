'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { CalendarDays, Clock, MapPin, X, RotateCcw, Store, History, AlertTriangle, Search } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/Toast'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
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
    const [filter, setFilter] = useState('all')
    const [cancelling, setCancelling] = useState(null)
    const [cancelModal, setCancelModal] = useState(null)

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
