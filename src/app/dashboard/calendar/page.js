'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { sendAppointmentConfirmation } from '@/lib/send-email'
import { ChevronLeft, ChevronRight, Plus, X, Search, Clock, User, Check, ArrowRight, ArrowLeft } from 'lucide-react'
import styles from './calendar.module.css'

const HOURS = Array.from({ length: 56 }, (_, i) => {
    const hour = Math.floor(i / 4) + 7
    const min = (i % 4) * 15
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
})
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
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function CalendarPage() {
    const { business, loading: authLoading } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [appointments, setAppointments] = useState([])
    const [showNewModal, setShowNewModal] = useState(false)
    const [newApt, setNewApt] = useState({ client_id: null, client_name: '', service_name: '', date: '', time: '', duration: 30, team_member_id: null })
    const [recurrence, setRecurrence] = useState({ enabled: false, type: 'weekly', count: 4 })
    const [teamMembers, setTeamMembers] = useState([])
    const [services, setServices] = useState([])
    const [clients, setClients] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [wizardStep, setWizardStep] = useState(1)
    const [clientSearch, setClientSearch] = useState('')
    const [occupiedSlots, setOccupiedSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [filterProfessional, setFilterProfessional] = useState(null)

    const weekDates = getWeekDates(currentDate)
    const today = formatDate(new Date())

    // Filter appointments by selected professional
    const filteredAppointments = filterProfessional
        ? appointments.filter(a => a.team_member_id === filterProfessional)
        : appointments

    const loadAppointments = useCallback(async () => {
        if (!supabase || !business?.id) return
        const wd = getWeekDates(currentDate)
        const start = formatDate(wd[0])
        const end = formatDate(wd[6])
        const { data, error: queryError } = await supabase
            .from('appointments')
            .select('*, clients(name, email, phone), team_members(name)')
            .eq('business_id', business.id)
            .gte('date', start)
            .lte('date', end)
            .order('time')
        if (queryError) console.error('[Calendar] Error:', queryError)
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

    const loadClients = useCallback(async () => {
        if (!supabase || !business?.id) return
        const { data } = await supabase
            .from('clients')
            .select('id, name, phone, email')
            .eq('business_id', business.id)
            .order('name')
        setClients(data || [])
    }, [business?.id])

    useEffect(() => {
        if (!business?.id) return
        loadAppointments()
        loadTeam()
        loadServices()
        loadClients()
    }, [business?.id, loadAppointments, loadTeam, loadServices, loadClients])

    async function handleCreateAppointment() {
        if (!supabase) return
        setError('')
        setSaving(true)
        try {
            let clientId = newApt.client_id
            let clientData = null

            if (clientId) {
                clientData = clients.find(c => c.id === clientId)
            } else if (newApt.client_name) {
                // Check if client already exists by name in this business
                const existing = clients.find(c =>
                    c.name?.toLowerCase().trim() === newApt.client_name.toLowerCase().trim()
                )
                if (existing) {
                    clientId = existing.id
                    clientData = existing
                } else {
                    const { data: newClient, error: clientError } = await supabase
                        .from('clients')
                        .insert([{ business_id: business.id, name: newApt.client_name }])
                        .select('id, name, email, phone')
                        .single()
                    if (clientError) throw clientError
                    clientId = newClient?.id
                    clientData = newClient
                }
            }

            const selectedService = services.find(s => s.name === newApt.service_name)
            const selectedProfessional = teamMembers.find(m => m.id === newApt.team_member_id)

            // Server-side availability check
            const checkRes = await fetch('/api/appointments/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: business.id,
                    date: newApt.date,
                    time: newApt.time,
                    duration: newApt.duration || selectedService?.duration || 30,
                    team_member_id: newApt.team_member_id || null,
                }),
            })
            const checkData = await checkRes.json()
            if (!checkData.available) {
                setError('Este horario ya está ocupado. Elegí otro.')
                setSaving(false)
                return
            }

            const appointmentData = {
                business_id: business.id,
                client_id: clientId,
                service_name: newApt.service_name,
                date: newApt.date,
                time: newApt.time,
                duration: newApt.duration || selectedService?.duration || 30,
                status: 'confirmed',
                team_member_id: newApt.team_member_id || null,
                price: selectedService?.price || null,
            }

            const { data: createdApt, error: aptError } = await supabase
                .from('appointments')
                .insert([appointmentData])
                .select()
                .single()
            if (aptError) throw aptError

            // Create recurring appointments if enabled
            if (recurrence.enabled && recurrence.count > 1) {
                const daysInterval = recurrence.type === 'weekly' ? 7 : recurrence.type === 'biweekly' ? 14 : 30
                const recurringApts = []
                for (let i = 1; i < recurrence.count; i++) {
                    const nextDate = new Date(newApt.date + 'T12:00:00')
                    nextDate.setDate(nextDate.getDate() + (daysInterval * i))
                    const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

                    // Check availability for each recurring date
                    const rCheckRes = await fetch('/api/appointments/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            business_id: business.id, date: nextDateStr, time: newApt.time,
                            duration: appointmentData.duration, team_member_id: newApt.team_member_id || null,
                        }),
                    })
                    const rCheck = await rCheckRes.json()
                    if (rCheck.available) {
                        recurringApts.push({
                            ...appointmentData,
                            date: nextDateStr,
                            parent_appointment_id: createdApt.id,
                            recurrence: { type: recurrence.type, parent_id: createdApt.id },
                        })
                    }
                }
                if (recurringApts.length > 0) {
                    await supabase.from('appointments').insert(recurringApts)
                }
            }

            setShowNewModal(false)
            resetWizard()
            await loadAppointments()
            await loadClients()

            if (clientData) {
                sendAppointmentConfirmation({
                    appointment: createdApt || appointmentData,
                    client: clientData,
                    business,
                    service: selectedService,
                    professional: selectedProfessional,
                }).catch(err => console.warn('Email send failed:', err))
            }
        } catch (err) {
            console.error('Error creating appointment:', err)
            setError('Error al crear el turno. Intentá de nuevo.')
        }
        setSaving(false)
    }

    function resetWizard() {
        setWizardStep(1)
        setNewApt({ client_id: null, client_name: '', service_name: '', date: '', time: '', duration: 30, team_member_id: null })
        setRecurrence({ enabled: false, type: 'weekly', count: 4 })
        setClientSearch('')
        setError('')
    }

    function openNewModal() {
        resetWizard()
        setShowNewModal(true)
    }

    const filteredClients = clients.filter(c =>
        c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone?.includes(clientSearch) ||
        c.email?.toLowerCase().includes(clientSearch.toLowerCase())
    )

    const getNext14Days = () => {
        const days = []
        for (let i = 0; i < 14; i++) {
            const d = new Date()
            d.setDate(d.getDate() + i)
            days.push(d)
        }
        return days
    }

    // Load occupied slots when wizard date or team member changes
    useEffect(() => {
        if (!newApt.date || !business?.id || !supabase || !showNewModal) return
        setLoadingSlots(true)
        let query = supabase
            .from('appointments')
            .select('time, duration, team_member_id')
            .eq('business_id', business.id)
            .eq('date', newApt.date)
            .not('status', 'in', '("cancelled","no_show")')

        if (newApt.team_member_id) {
            query = query.eq('team_member_id', newApt.team_member_id)
        }

        query.then(({ data }) => {
            setOccupiedSlots((data || []).map(apt => {
                const [h, m] = apt.time.split(':').map(Number)
                const startMin = h * 60 + m
                return { startMin, endMin: startMin + (apt.duration || 30) }
            }))
            setLoadingSlots(false)
        })
    }, [newApt.date, newApt.team_member_id, business?.id, showNewModal])

    const getAvailableSlots = () => {
        const startH = business?.settings?.work_hours?.start || '09:00'
        const endH = business?.settings?.work_hours?.end || '20:00'
        const [sh, sm] = startH.split(':').map(Number)
        const [eh, em] = endH.split(':').map(Number)
        const allSlots = []
        for (let h = sh; h <= eh; h++) {
            for (let m = 0; m < 60; m += 15) {
                if (h === sh && m < sm) continue
                if (h === eh && m > em) continue
                allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
            }
        }
        // Filter occupied slots
        const duration = newApt.duration || 30
        return allSlots.filter(slot => {
            const [sh2, sm2] = slot.split(':').map(Number)
            const slotStart = sh2 * 60 + sm2
            const slotEnd = slotStart + duration
            return !occupiedSlots.some(o => slotStart < o.endMin && slotEnd > o.startMin)
        })
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
        return filteredAppointments.filter(a => a.date === dateStr && a.time?.slice(0, 5) === hour)
    }

    const getAppointmentsForSlot = (date, hour) => {
        const dateStr = formatDate(date)
        return filteredAppointments.filter(a => a.date === dateStr && a.time?.slice(0, 5) === hour)
    }

    const statusColor = (status) => {
        const colors = { pending: '#F59E0B', confirmed: '#6366F1', completed: '#22C55E', cancelled: '#EF4444' }
        return colors[status] || '#9CA3AF'
    }

    if (authLoading || !business?.id) {
        return (
            <div className={styles.calendar}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
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
                <button className="btn btn-primary" onClick={openNewModal}>
                    <Plus size={16} /> Nuevo turno
                </button>
            </div>

            {teamMembers.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                    <button
                        className={`btn btn-sm ${!filterProfessional ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterProfessional(null)}
                    >
                        Todos
                    </button>
                    {teamMembers.map(m => (
                        <button
                            key={m.id}
                            className={`btn btn-sm ${filterProfessional === m.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilterProfessional(filterProfessional === m.id ? null : m.id)}
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
            )}

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
                                        resetWizard()
                                        setNewApt(prev => ({ ...prev, date: formatDate(date), time: hour }))
                                        setWizardStep(3)
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
                                resetWizard()
                                setNewApt(prev => ({ ...prev, date: formatDate(currentDate), time: hour }))
                                setWizardStep(3)
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
                    <div className="modal" style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                {wizardStep > 1 && (
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setWizardStep(wizardStep - 1)}>
                                        <ArrowLeft size={16} />
                                    </button>
                                )}
                                <div>
                                    <h3 style={{ margin: 0 }}>Nuevo turno</h3>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Paso {wizardStep} de 4</span>
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewModal(false)}><X size={16} /></button>
                        </div>

                        {/* Progress bar */}
                        <div className={styles.wizardProgress}>
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className={`${styles.wizardDot} ${s <= wizardStep ? styles.wizardDotActive : ''} ${s === wizardStep ? styles.wizardDotCurrent : ''}`} />
                            ))}
                        </div>

                        {services.length === 0 ? (
                            <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
                                <p style={{ marginBottom: 'var(--space-4)' }}>
                                    <strong>No tenés servicios configurados.</strong><br />
                                    Para crear un turno necesitás tener al menos un servicio.
                                </p>
                                <Link href="/dashboard/services" className="btn btn-primary" style={{ display: 'inline-flex' }}>Ir a Servicios</Link>
                            </div>
                        ) : (
                            <>
                                <div className="modal-body" style={{ minHeight: 280 }}>
                                    {error && (
                                        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                            {error}
                                        </div>
                                    )}

                                    {/* STEP 1: Client */}
                                    {wizardStep === 1 && (
                                        <div>
                                            <label className="label" style={{ marginBottom: 'var(--space-3)' }}>¿Quién es el cliente?</label>
                                            <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
                                                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                                                <input
                                                    className="input"
                                                    style={{ paddingLeft: 36 }}
                                                    placeholder="Buscar cliente o escribir nombre..."
                                                    value={clientSearch}
                                                    onChange={e => { setClientSearch(e.target.value); setNewApt(prev => ({ ...prev, client_name: e.target.value, client_id: null })) }}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className={styles.clientList}>
                                                {clientSearch && !filteredClients.find(c => c.name?.toLowerCase() === clientSearch.toLowerCase()) && (
                                                    <button
                                                        className={`${styles.clientItem} ${styles.clientItemNew}`}
                                                        onClick={() => {
                                                            setNewApt(prev => ({ ...prev, client_name: clientSearch, client_id: null }))
                                                            setWizardStep(2)
                                                        }}
                                                    >
                                                        <div className={styles.clientAvatar} style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                                                            <Plus size={16} />
                                                        </div>
                                                        <div className={styles.clientInfo}>
                                                            <span className={styles.clientName}>Crear "{clientSearch}"</span>
                                                            <span className={styles.clientDetail}>Nuevo cliente</span>
                                                        </div>
                                                    </button>
                                                )}
                                                {filteredClients.map(client => (
                                                    <button
                                                        key={client.id}
                                                        className={`${styles.clientItem} ${newApt.client_id === client.id ? styles.clientItemSelected : ''}`}
                                                        onClick={() => {
                                                            setNewApt(prev => ({ ...prev, client_id: client.id, client_name: client.name }))
                                                            setClientSearch(client.name)
                                                            setWizardStep(2)
                                                        }}
                                                    >
                                                        <div className={styles.clientAvatar}>
                                                            {client.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div className={styles.clientInfo}>
                                                            <span className={styles.clientName}>{client.name}</span>
                                                            <span className={styles.clientDetail}>{client.phone || client.email || ''}</span>
                                                        </div>
                                                        {newApt.client_id === client.id && <Check size={16} style={{ color: 'var(--accent)' }} />}
                                                    </button>
                                                ))}
                                                {filteredClients.length === 0 && !clientSearch && (
                                                    <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                                        Escribí un nombre para buscar o crear un cliente
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: Service */}
                                    {wizardStep === 2 && (
                                        <div>
                                            <label className="label" style={{ marginBottom: 'var(--space-3)' }}>¿Qué servicio?</label>
                                            <div className={styles.serviceGrid}>
                                                {services.map((svc, i) => (
                                                    <button
                                                        key={i}
                                                        className={`${styles.serviceCard} ${newApt.service_name === svc.name ? styles.serviceCardSelected : ''}`}
                                                        onClick={() => {
                                                            setNewApt(prev => ({ ...prev, service_name: svc.name, duration: svc.duration || 30 }))
                                                            setWizardStep(3)
                                                        }}
                                                    >
                                                        <div className={styles.serviceCardTop}>
                                                            <span className={styles.serviceCardName}>{svc.name}</span>
                                                            {newApt.service_name === svc.name && <Check size={16} style={{ color: 'var(--accent)' }} />}
                                                        </div>
                                                        <div className={styles.serviceCardBottom}>
                                                            <span className={styles.serviceCardDuration}>
                                                                <Clock size={12} /> {svc.duration || 30} min
                                                            </span>
                                                            <span className={styles.serviceCardPrice}>${svc.price?.toLocaleString()}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 3: Date, Time & Professional */}
                                    {wizardStep === 3 && (
                                        <div>
                                            <label className="label" style={{ marginBottom: 'var(--space-3)' }}>¿Cuándo?</label>
                                            <div className={styles.datePills}>
                                                {getNext14Days().map((d, i) => {
                                                    const ds = formatDate(d)
                                                    const isToday = ds === today
                                                    return (
                                                        <button
                                                            key={i}
                                                            className={`${styles.datePill} ${newApt.date === ds ? styles.datePillSelected : ''} ${isToday ? styles.datePillToday : ''}`}
                                                            onClick={() => setNewApt(prev => ({ ...prev, date: ds }))}
                                                        >
                                                            <span className={styles.datePillDay}>{d.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
                                                            <span className={styles.datePillNum}>{d.getDate()}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {newApt.date && (
                                                <>
                                                    {teamMembers.length > 0 && (
                                                        <div style={{ marginBottom: 'var(--space-3)' }}>
                                                            <label className="label" style={{ marginBottom: 'var(--space-2)' }}>Profesional</label>
                                                            <div className={styles.proPills}>
                                                                <button
                                                                    className={`${styles.proPill} ${!newApt.team_member_id ? styles.proPillSelected : ''}`}
                                                                    onClick={() => setNewApt(prev => ({ ...prev, team_member_id: null }))}
                                                                >
                                                                    Cualquiera
                                                                </button>
                                                                {teamMembers.map(m => (
                                                                    <button
                                                                        key={m.id}
                                                                        className={`${styles.proPill} ${newApt.team_member_id === m.id ? styles.proPillSelected : ''}`}
                                                                        onClick={() => setNewApt(prev => ({ ...prev, team_member_id: m.id }))}
                                                                    >
                                                                        {m.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <label className="label" style={{ marginBottom: 'var(--space-2)' }}>Horario</label>
                                                    {loadingSlots ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                                                            <div className="loading-spinner" />
                                                        </div>
                                                    ) : getAvailableSlots().length === 0 ? (
                                                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                                            No hay horarios disponibles para esta fecha. Probá otro día.
                                                        </p>
                                                    ) : (
                                                        <div className={styles.timeGrid}>
                                                            {getAvailableSlots().map(slot => (
                                                                <button
                                                                    key={slot}
                                                                    className={`${styles.timeSlot} ${newApt.time === slot ? styles.timeSlotSelected : ''}`}
                                                                    onClick={() => {
                                                                        setNewApt(prev => ({ ...prev, time: slot }))
                                                                        setWizardStep(4)
                                                                    }}
                                                                >
                                                                    {slot}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* STEP 4: Summary */}
                                    {wizardStep === 4 && (
                                        <div>
                                            <label className="label" style={{ marginBottom: 'var(--space-3)' }}>Confirmar turno</label>
                                            <div className={styles.summaryCard}>
                                                <div className={styles.summaryRow}>
                                                    <span className={styles.summaryLabel}>Cliente</span>
                                                    <span className={styles.summaryValue}>{newApt.client_name}</span>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <span className={styles.summaryLabel}>Servicio</span>
                                                    <span className={styles.summaryValue}>{newApt.service_name}</span>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <span className={styles.summaryLabel}>Fecha</span>
                                                    <span className={styles.summaryValue}>
                                                        {newApt.date ? new Date(newApt.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                                                    </span>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <span className={styles.summaryLabel}>Hora</span>
                                                    <span className={styles.summaryValue}>{newApt.time}</span>
                                                </div>
                                                <div className={styles.summaryRow}>
                                                    <span className={styles.summaryLabel}>Duración</span>
                                                    <span className={styles.summaryValue}>{newApt.duration} min</span>
                                                </div>
                                                {newApt.team_member_id && (
                                                    <div className={styles.summaryRow}>
                                                        <span className={styles.summaryLabel}>Profesional</span>
                                                        <span className={styles.summaryValue}>{teamMembers.find(m => m.id === newApt.team_member_id)?.name}</span>
                                                    </div>
                                                )}
                                                {(() => {
                                                    const svc = services.find(s => s.name === newApt.service_name)
                                                    return svc?.price ? (
                                                        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                                                            <span className={styles.summaryLabel}>Total</span>
                                                            <span className={styles.summaryValue}>${svc.price.toLocaleString()}</span>
                                                        </div>
                                                    ) : null
                                                })()}
                                            </div>

                                            {/* Recurrence option */}
                                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                                                    <input type="checkbox" checked={recurrence.enabled}
                                                        onChange={e => setRecurrence(prev => ({ ...prev, enabled: e.target.checked }))} />
                                                    Repetir turno
                                                </label>
                                                {recurrence.enabled && (
                                                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                                                        <select className="input" style={{ flex: 1, minWidth: 120 }}
                                                            value={recurrence.type}
                                                            onChange={e => setRecurrence(prev => ({ ...prev, type: e.target.value }))}>
                                                            <option value="weekly">Semanal</option>
                                                            <option value="biweekly">Quincenal</option>
                                                            <option value="monthly">Mensual</option>
                                                        </select>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                                                            <input className="input" type="number" min="2" max="12" style={{ width: 60 }}
                                                                value={recurrence.count}
                                                                onChange={e => setRecurrence(prev => ({ ...prev, count: parseInt(e.target.value) || 2 }))} />
                                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>veces</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="modal-footer">
                                    {wizardStep < 4 ? (
                                        <>
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                                            {wizardStep === 1 && newApt.client_name && (
                                                <button className="btn btn-primary" onClick={() => setWizardStep(2)}>
                                                    Siguiente <ArrowRight size={14} />
                                                </button>
                                            )}
                                            {wizardStep === 2 && newApt.service_name && (
                                                <button className="btn btn-primary" onClick={() => setWizardStep(3)}>
                                                    Siguiente <ArrowRight size={14} />
                                                </button>
                                            )}
                                            {wizardStep === 3 && newApt.date && newApt.time && (
                                                <button className="btn btn-primary" onClick={() => setWizardStep(4)}>
                                                    Siguiente <ArrowRight size={14} />
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(3)}>Volver</button>
                                            <button className="btn btn-primary btn-lg" onClick={handleCreateAppointment} disabled={saving} style={{ flex: 1 }}>
                                                {saving ? <div className="loading-spinner" /> : <><Check size={16} /> Confirmar turno</>}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
