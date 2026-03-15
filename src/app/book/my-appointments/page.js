'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { CalendarDays, Clock, MapPin, Check, X, RotateCcw, ArrowLeft, Store, History } from 'lucide-react'
import Link from 'next/link'
import styles from './my-appointments.module.css'

export default function MyAppointmentsPage() {
    const { user, loading: authLoading } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('upcoming') // 'upcoming' | 'past' | 'cancelled'
    const [cancelling, setCancelling] = useState(null)

    useEffect(() => {
        if (user) loadAppointments()
    }, [user])

    async function loadAppointments() {
        if (!supabase || !user) { setLoading(false); return }

        // Find all clients matching the user's email across all businesses
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

        // Fetch appointments for all matching clients
        const { data: appts } = await supabase
            .from('appointments')
            .select('*')
            .in('client_id', clientIds)
            .order('date', { ascending: false })

        // Fetch business info for display
        const { data: businesses } = await supabase
            .from('businesses')
            .select('id, name, address, phone, business_type, settings')
            .in('id', businessIds)

        const bizMap = {}
        businesses?.forEach(b => bizMap[b.id] = b)

        const enriched = (appts || []).map(a => ({
            ...a,
            business: bizMap[a.business_id] || null
        }))

        setAppointments(enriched)
        setLoading(false)
    }

    async function handleCancel(appointmentId, businessSettings) {
        const minHours = businessSettings?.min_cancel_hours ?? 2
        const appointment = appointments.find(a => a.id === appointmentId)
        if (!appointment) return

        // Check cancellation policy
        const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`)
        const now = new Date()
        const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60)

        if (hoursUntil < minHours) {
            alert(`No podés cancelar con menos de ${minHours} horas de anticipación. Contactá al negocio directamente.`)
            return
        }

        if (!confirm('¿Estás seguro/a de que querés cancelar este turno?')) return

        setCancelling(appointmentId)
        try {
            await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId)
            setAppointments(prev => prev.map(a =>
                a.id === appointmentId ? { ...a, status: 'cancelled' } : a
            ))
        } catch (err) {
            console.error('Cancel error:', err)
            alert('Error al cancelar. Intentá de nuevo.')
        }
        setCancelling(null)
    }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    const filtered = appointments.filter(a => {
        if (filter === 'upcoming') return a.date >= today && a.status !== 'cancelled'
        if (filter === 'past') {
            const aptDate = new Date(`${a.date}T${a.time || '23:59'}`)
            return aptDate < now && a.status !== 'cancelled'
        }
        if (filter === 'cancelled') return a.status === 'cancelled'
        return true
    })

    const statusLabels = {
        confirmed: { label: 'Confirmado', color: '#16A34A', bg: '#F0FDF4' },
        pending: { label: 'Pendiente', color: '#D97706', bg: '#FFFBEB' },
        completed: { label: 'Completado', color: '#6366F1', bg: '#EEF2FF' },
        cancelled: { label: 'Cancelado', color: '#DC2626', bg: '#FEF2F2' },
        no_show: { label: 'No asistió', color: '#94A3B8', bg: '#F1F5F9' },
    }

    if (authLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
            </div>
        )
    }

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
                    <Link href="/book" className={styles.backBtn}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1>Mis turnos</h1>
                        <p>Historial y próximos turnos</p>
                    </div>
                </div>

                {/* Filters */}
                <div className={styles.filters}>
                    <button
                        className={`${styles.filterBtn} ${filter === 'upcoming' ? styles.active : ''}`}
                        onClick={() => setFilter('upcoming')}
                    >
                        <CalendarDays size={14} /> Próximos
                    </button>
                    <button
                        className={`${styles.filterBtn} ${filter === 'past' ? styles.active : ''}`}
                        onClick={() => setFilter('past')}
                    >
                        <History size={14} /> Pasados
                    </button>
                    <button
                        className={`${styles.filterBtn} ${filter === 'cancelled' ? styles.active : ''}`}
                        onClick={() => setFilter('cancelled')}
                    >
                        <X size={14} /> Cancelados
                    </button>
                </div>

                {/* Appointments */}
                {loading ? (
                    <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>
                        <CalendarDays size={40} />
                        <h3>{filter === 'upcoming' ? 'No tenés turnos próximos' : filter === 'past' ? 'No tenés turnos pasados' : 'No tenés turnos cancelados'}</h3>
                        <p>Reservá un turno para empezar</p>
                        <Link href="/book" className="btn btn-primary">Explorar negocios</Link>
                    </div>
                ) : (
                    <div className={styles.appointmentList}>
                        {filtered.map(apt => {
                            const dateObj = new Date(apt.date + 'T12:00:00')
                            const status = statusLabels[apt.status] || statusLabels.pending
                            const canCancel = filter === 'upcoming' && apt.status !== 'cancelled'

                            return (
                                <div key={apt.id} className={styles.appointmentCard}>
                                    <div className={styles.appointmentTop}>
                                        <div className={styles.dateBlock}>
                                            <span className={styles.dateDay}>{dateObj.getDate()}</span>
                                            <span className={styles.dateMonth}>{dateObj.toLocaleDateString('es-AR', { month: 'short' })}</span>
                                        </div>
                                        <div className={styles.appointmentInfo}>
                                            <h3>{apt.service_name}</h3>
                                            <div className={styles.appointmentMeta}>
                                                <span><Clock size={12} /> {apt.time?.slice(0, 5)} — {apt.duration} min</span>
                                                {apt.price && <span>${apt.price.toLocaleString()}</span>}
                                            </div>
                                            {apt.business && (
                                                <div className={styles.businessInfo}>
                                                    <Store size={12} />
                                                    <span>{apt.business.name}</span>
                                                    {apt.business.address && (
                                                        <>
                                                            <MapPin size={10} />
                                                            <span className={styles.address}>{apt.business.address}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            className={styles.statusBadge}
                                            style={{ background: status.bg, color: status.color }}
                                        >
                                            {status.label}
                                        </span>
                                    </div>

                                    {canCancel && (
                                        <div className={styles.appointmentActions}>
                                            <Link href={`/book/${apt.business_id}`} className={styles.actionBtn}>
                                                <RotateCcw size={13} /> Reprogramar
                                            </Link>
                                            <button
                                                className={`${styles.actionBtn} ${styles.cancelBtn}`}
                                                onClick={() => handleCancel(apt.id, apt.business?.settings)}
                                                disabled={cancelling === apt.id}
                                            >
                                                {cancelling === apt.id ? (
                                                    <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                                                ) : (
                                                    <><X size={13} /> Cancelar</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
