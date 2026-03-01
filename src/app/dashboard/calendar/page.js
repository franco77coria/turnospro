'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import styles from './calendar.module.css'

const HOURS = Array.from({ length: 14 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`)
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function getWeekDates(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    return Array.from({ length: 7 }, (_, i) => {
        const dt = new Date(monday)
        dt.setDate(monday.getDate() + i)
        return dt
    })
}

function formatDate(d) {
    return d.toISOString().split('T')[0]
}

export default function CalendarPage() {
    const { business } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [appointments, setAppointments] = useState([])
    const [showNewModal, setShowNewModal] = useState(false)
    const [newApt, setNewApt] = useState({ client_name: '', service_name: '', date: '', time: '', duration: 30 })
    const [teamMembers, setTeamMembers] = useState([])
    const [services, setServices] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const weekDates = getWeekDates(currentDate)
    const today = formatDate(new Date())

    const loadAppointments = useCallback(async () => {
        if (!supabase || !business?.id) return
        const start = formatDate(weekDates[0])
        const end = formatDate(weekDates[6])
        const { data } = await supabase
            .from('appointments')
            .select('*, clients(name), team_members(name)')
            .eq('business_id', business.id)
            .gte('date', start)
            .lte('date', end)
            .order('time')
        setAppointments(data || [])
    }, [business?.id, currentDate])

    const loadTeam = useCallback(async () => {
        if (!supabase || !business?.id) return
        const { data } = await supabase
            .from('team_members')
            .select('*')
            .eq('business_id', business.id)
            .eq('active', true)
        setTeamMembers(data || [])
    }, [business?.id])

    // Load services directly from DB for reliability
    const loadServices = useCallback(async () => {
        if (!supabase || !business?.id) return
        const { data } = await supabase
            .from('businesses')
            .select('services')
            .eq('id', business.id)
            .single()
        setServices(Array.isArray(data?.services) ? data.services : [])
    }, [business?.id])

    useEffect(() => {
        if (!business?.id) return
        loadAppointments()
        loadTeam()
        loadServices()
    }, [business?.id, loadAppointments, loadTeam, loadServices])

    async function handleCreateAppointment(e) {
        e.preventDefault()
        if (!supabase) return
        setError('')
        setSaving(true)
        try {
            let clientId = null
            if (newApt.client_name) {
                const { data: existingClient } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('business_id', business.id)
                    .eq('name', newApt.client_name)
                    .maybeSingle()

                if (existingClient) {
                    clientId = existingClient.id
                } else {
                    const { data: newClient, error: clientError } = await supabase
                        .from('clients')
                        .insert([{ business_id: business.id, name: newApt.client_name }])
                        .select()
                        .single()
                    if (clientError) throw clientError
                    clientId = newClient?.id
                }
            }

            const selectedService = services.find(s => s.name === newApt.service_name)

            const { error: aptError } = await supabase.from('appointments').insert([{
                business_id: business.id,
                client_id: clientId,
                service_name: newApt.service_name,
                date: newApt.date,
                time: newApt.time,
                duration: newApt.duration || selectedService?.duration || 30,
                status: 'confirmed',
                team_member_id: newApt.team_member_id || null,
                price: selectedService?.price || null,
            }])
            if (aptError) throw aptError

            setShowNewModal(false)
            setNewApt({ client_name: '', service_name: '', date: '', time: '', duration: 30 })
            loadAppointments()
        } catch (err) {
            console.error('Error creating appointment:', err)
            setError('Error al crear el turno. Intenta de nuevo.')
        }
        setSaving(false)
    }

    function navigate(dir) {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + (dir * 7))
        setCurrentDate(d)
    }

    function navigateDay(dir) {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + dir)
        setCurrentDate(d)
    }

    const getMobileAppointments = (hour) => {
        const dateStr = formatDate(currentDate)
        return appointments.filter(a => a.date === dateStr && a.time?.startsWith(hour.split(':')[0]))
    }

    const getAppointmentsForSlot = (date, hour) => {
        const dateStr = formatDate(date)
        return appointments.filter(a => a.date === dateStr && a.time?.startsWith(hour.split(':')[0]))
    }

    const statusColor = (status) => {
        const colors = { pending: '#F59E0B', confirmed: '#6366F1', completed: '#22C55E', cancelled: '#EF4444' }
        return colors[status] || '#9CA3AF'
    }

    return (
        <div className={styles.calendar}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1>Calendario</h1>
                    <div className={styles.navBtns}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())}>Hoy</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(1)}><ChevronRight size={16} /></button>
                    </div>
                    <span className={styles.currentMonth}>
                        {currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                    </span>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setNewApt(prev => ({ ...prev, date: today }))
                    setError('')
                    setShowNewModal(true)
                }}>
                    <Plus size={16} /> Nuevo turno
                </button>
            </div>

            <div className={styles.calendarGrid}>
                <div className={styles.gridHeader}>
                    <div className={styles.timeCol}></div>
                    {weekDates.map((date, i) => (
                        <div key={i} className={`${styles.dayCol} ${formatDate(date) === today ? styles.today : ''}`}>
                            <span className={styles.dayName}>{DAYS[date.getDay()]}</span>
                            <span className={styles.dayNum}>{date.getDate()}</span>
                        </div>
                    ))}
                </div>

                <div className={styles.gridBody}>
                    {HOURS.map(hour => (
                        <div key={hour} className={styles.timeRow}>
                            <div className={styles.timeLabel}>{hour}</div>
                            {weekDates.map((date, i) => {
                                const slotApts = getAppointmentsForSlot(date, hour)
                                return (
                                    <div key={i} className={styles.cell} onClick={() => {
                                        setNewApt(prev => ({ ...prev, date: formatDate(date), time: hour }))
                                        setError('')
                                        setShowNewModal(true)
                                    }}>
                                        {slotApts.map(apt => (
                                            <div
                                                key={apt.id}
                                                className={styles.aptBlock}
                                                style={{ borderLeftColor: statusColor(apt.status) }}
                                            >
                                                <span className={styles.aptBlockName}>{apt.clients?.name || apt.service_name}</span>
                                                <span className={styles.aptBlockService}>{apt.time?.slice(0, 5)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile: Day view */}
            <div className={styles.mobileView}>
                <div className={styles.mobileHeader}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigateDay(-1)}><ChevronLeft size={16} /></button>
                    <span className={styles.mobileDateLabel}>
                        {currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigateDay(1)}><ChevronRight size={16} /></button>
                </div>
                <div className={styles.mobileTimeline}>
                    {HOURS.map(hour => {
                        const slotApts = getMobileAppointments(hour)
                        return (
                            <div key={hour} className={styles.mobileSlot} onClick={() => {
                                setNewApt(prev => ({ ...prev, date: formatDate(currentDate), time: hour }))
                                setError('')
                                setShowNewModal(true)
                            }}>
                                <span className={styles.mobileSlotTime}>{hour}</span>
                                <div className={styles.mobileSlotContent}>
                                    {slotApts.length > 0 ? slotApts.map(apt => (
                                        <div key={apt.id} className={styles.mobileApt} style={{ borderLeftColor: statusColor(apt.status) }}>
                                            <span className={styles.mobileAptName}>{apt.clients?.name || apt.service_name}</span>
                                            <span className={styles.mobileAptService}>{apt.service_name} - {apt.time?.slice(0, 5)}</span>
                                        </div>
                                    )) : null}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {showNewModal && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Nuevo turno</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewModal(false)}><X size={16} /></button>
                        </div>
                        {services.length === 0 ? (
                            <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                                <p style={{ marginBottom: 'var(--space-4)' }}>
                                    <strong>No tenés servicios configurados.</strong><br />
                                    Para crear un turno necesitás tener al menos un servicio en tu rubro.
                                </p>
                                <a href="/dashboard/services" className="btn btn-primary" style={{ display: 'inline-flex' }}>Ir a Servicios</a>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateAppointment}>
                                <div className="modal-body">
                                    {error && (
                                        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                            {error}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="label">Cliente</label>
                                        <input className="input" placeholder="Nombre del cliente" value={newApt.client_name}
                                            onChange={e => setNewApt(prev => ({ ...prev, client_name: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Servicio</label>
                                        <select className="input select" value={newApt.service_name}
                                            onChange={e => {
                                                const svc = services.find(s => s.name === e.target.value)
                                                setNewApt(prev => ({ ...prev, service_name: e.target.value, duration: svc?.duration || 30 }))
                                            }} required>
                                            <option value="">Seleccionar...</option>
                                            {services.map((s, i) => (
                                                <option key={i} value={s.name}>{s.name} — ${s.price?.toLocaleString()}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                        <div className="form-group">
                                            <label className="label">Fecha</label>
                                            <input className="input" type="date" value={newApt.date}
                                                onChange={e => setNewApt(prev => ({ ...prev, date: e.target.value }))} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Hora</label>
                                            <input className="input" type="time" value={newApt.time}
                                                onChange={e => setNewApt(prev => ({ ...prev, time: e.target.value }))} required />
                                        </div>
                                    </div>
                                    {teamMembers.length > 0 && (
                                        <div className="form-group">
                                            <label className="label">Profesional</label>
                                            <select className="input select" value={newApt.team_member_id || ''}
                                                onChange={e => setNewApt(prev => ({ ...prev, team_member_id: e.target.value }))}>
                                                <option value="">Cualquiera</option>
                                                {teamMembers.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <div className="loading-spinner" /> : 'Crear turno'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
