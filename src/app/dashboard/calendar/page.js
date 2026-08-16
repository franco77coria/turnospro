'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { sendAppointmentConfirmation } from '@/lib/send-email'
import { loadBusinessServices, findServiceByName } from '@/lib/services'
import {
    DEFAULT_DURATION,
    formatDateLocal,
    generateAvailableSlots,
    layoutDayAppointments,
    minutesToTime,
    resolveCalendarRange,
    resolveScheduleSettings,
    timeToMinutes,
    toOccupiedRanges,
} from '@/lib/scheduling'
import { ChevronLeft, ChevronRight, Plus, X, Search, Clock, Check, ArrowRight, ArrowLeft, Pencil, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import styles from './calendar.module.css'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Escala del calendario: 1 minuto = 1.4 px. Un turno de 45 min mide 63 px,
// uno de 30 min mide 42 px. La altura del bloque ES la duración.
const PX_PER_MIN = 1.4
const MIN_BLOCK_MINUTES = 15

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

const formatDate = formatDateLocal

export default function CalendarPage() {
    const { user, profile, business, loading: authLoading } = useAuth()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [appointments, setAppointments] = useState([])
    const [showNewModal, setShowNewModal] = useState(false)
    const [newApt, setNewApt] = useState({ client_id: null, client_name: '', service_name: '', date: '', time: '', duration: DEFAULT_DURATION, team_member_id: null })
    const [recurrence, setRecurrence] = useState({ enabled: false, type: 'weekly', count: 4 })
    const [teamMembers, setTeamMembers] = useState([])
    const [services, setServices] = useState([])
    const [clients, setClients] = useState([])
    const [closureDates, setClosureDates] = useState([])
    const [teamAbsences, setTeamAbsences] = useState([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [wizardStep, setWizardStep] = useState(1)
    const [clientSearch, setClientSearch] = useState('')
    const [occupiedSlots, setOccupiedSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [filterProfessional, setFilterProfessional] = useState(null)
    const [currentMember, setCurrentMember] = useState(null)

    const [editingApt, setEditingApt] = useState(null)
    const [editForm, setEditForm] = useState({ date: '', time: '', service_name: '', duration: DEFAULT_DURATION, notes: '', status: '' })
    const [savingEdit, setSavingEdit] = useState(false)
    const [editError, setEditError] = useState('')

    const scheduleSettings = useMemo(() => resolveScheduleSettings(business?.settings), [business?.settings])

    function handleOpenEdit(apt) {
        setEditError('')
        setEditingApt(apt)
        setEditForm({
            date: apt.date || '',
            time: apt.time?.slice(0, 5) || '',
            service_name: apt.service_name || '',
            duration: apt.duration || DEFAULT_DURATION,
            notes: apt.notes || '',
            status: apt.status || 'pending',
        })
    }

    async function handleSaveEdit(e) {
        e.preventDefault()
        if (!editingApt) return
        setEditError('')
        setSavingEdit(true)
        try {
            const res = await fetch(`/api/appointments/${editingApt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    duration: parseInt(editForm.duration, 10) || DEFAULT_DURATION,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al guardar')

            // Send cancellation email if status changed to cancelled
            if (editForm.status === 'cancelled' && editingApt.clients?.email) {
                fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'cancellation',
                        to: editingApt.clients.email,
                        data: {
                            clientName: editingApt.clients.name || 'Cliente',
                            serviceName: editForm.service_name || editingApt.service_name,
                            date: editForm.date || editingApt.date,
                            time: editForm.time || editingApt.time,
                            businessName: business?.name || 'Tu GlowUp',
                            businessType: business?.business_type || 'custom',
                            businessPhone: business?.phone,
                        }
                    })
                }).catch(() => {})
            }

            setEditingApt(null)
            loadAppointments()
        } catch (err) {
            setEditError(err.message || 'Error al guardar los cambios')
        } finally {
            setSavingEdit(false)
        }
    }

    // Load active employee data if current profile is a Professional
    useEffect(() => {
        async function fetchCurrentMember() {
            if (!supabase || !user?.id || profile?.role !== 'Profesional') return
            try {
                const { data } = await supabase
                    .from('team_members')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle()
                if (data) {
                    setCurrentMember(data)
                    setFilterProfessional(data.id)
                }
            } catch (err) {
                console.error('[Calendar] Error fetching employee details:', err)
            }
        }
        fetchCurrentMember()
    }, [user?.id, profile?.role])

    const weekDates = getWeekDates(currentDate)
    const today = formatDate(new Date())

    // Filter appointments by selected professional
    const filteredAppointments = filterProfessional
        ? appointments.filter(a => a.team_member_id === filterProfessional)
        : appointments

    // El calendario arranca en el horario de atención, pero se estira si hay
    // turnos fuera de horario — antes quedaban invisibles con la grilla fija 07:00-20:45.
    const { startMin: rangeStart, endMin: rangeEnd } = useMemo(
        () => resolveCalendarRange(business?.settings, filteredAppointments),
        [business?.settings, filteredAppointments]
    )
    const totalMinutes = rangeEnd - rangeStart
    const canvasHeight = totalMinutes * PX_PER_MIN

    const hourMarks = useMemo(() => {
        const marks = []
        for (let m = rangeStart; m <= rangeEnd; m += 60) marks.push(m)
        return marks
    }, [rangeStart, rangeEnd])

    const halfHourMarks = useMemo(() => {
        const marks = []
        for (let m = rangeStart + 30; m < rangeEnd; m += 60) marks.push(m)
        return marks
    }, [rangeStart, rangeEnd])

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
            // Los cancelados no ocupan lugar en la agenda: no se dibujan.
            .not('status', 'in', '("cancelled","no_show")')
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

    // Servicios desde la fuente única — la misma que ve la reserva pública.
    const loadServices = useCallback(async () => {
        if (!supabase || !business?.id) return
        setServices(await loadBusinessServices(supabase, business.id, { activeOnly: true }))
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

    const loadCalendarBlocks = useCallback(async () => {
        if (!supabase || !business?.id) return
        const todayStr = formatDate(new Date())
        const [{ data: closures }, { data: absences }] = await Promise.all([
            supabase.from('business_closures').select('date').eq('business_id', business.id).gte('date', todayStr),
            supabase.from('team_absences').select('team_member_id, start_date, end_date').eq('business_id', business.id).gte('end_date', todayStr),
        ])
        const settingsClosed = (business?.settings?.closed_dates || []).map(cd => cd.date)
        setClosureDates([...new Set([...settingsClosed, ...(closures || []).map(c => c.date)])])
        setTeamAbsences(absences || [])
    }, [business?.id, business?.settings])

    useEffect(() => {
        if (!business?.id) return
        loadAppointments()
        loadTeam()
        loadServices()
        loadClients()
        loadCalendarBlocks()
    }, [business?.id, loadAppointments, loadTeam, loadServices, loadClients, loadCalendarBlocks])

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

            const selectedService = findServiceByName(services, newApt.service_name)
            const selectedProfessional = teamMembers.find(m => m.id === newApt.team_member_id)
            const duration = newApt.duration || selectedService?.duration || DEFAULT_DURATION

            // Server-side availability check
            const checkRes = await fetch('/api/appointments/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: business.id,
                    date: newApt.date,
                    time: newApt.time,
                    duration,
                    team_member_id: newApt.team_member_id || null,
                    buffer_time: scheduleSettings.bufferTime,
                    // El dueño puede agendar en un día cerrado o con el profesional
                    // de licencia; ya se le avisa con un cartel en el paso anterior.
                    ignore_closures: true,
                }),
            })
            const checkData = await checkRes.json()
            if (!checkData.available) {
                setError(checkData.reason || 'Este horario ya está ocupado. Elegí otro.')
                setSaving(false)
                return
            }

            const appointmentData = {
                business_id: business.id,
                client_id: clientId,
                service_name: newApt.service_name,
                date: newApt.date,
                time: newApt.time,
                duration,
                status: 'confirmed',
                team_member_id: newApt.team_member_id || null,
                price: selectedService?.price ?? null,
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
                const skipped = []
                for (let i = 1; i < recurrence.count; i++) {
                    const nextDate = new Date(newApt.date + 'T12:00:00')
                    nextDate.setDate(nextDate.getDate() + (daysInterval * i))
                    const nextDateStr = formatDate(nextDate)

                    // Check availability for each recurring date
                    const rCheckRes = await fetch('/api/appointments/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            business_id: business.id, date: nextDateStr, time: newApt.time,
                            duration, team_member_id: newApt.team_member_id || null,
                            buffer_time: scheduleSettings.bufferTime,
                            ignore_closures: true,
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
                    } else {
                        skipped.push(nextDateStr)
                    }
                }
                if (recurringApts.length > 0) {
                    await supabase.from('appointments').insert(recurringApts)
                }
                // Antes las repeticiones ocupadas se descartaban en silencio.
                if (skipped.length > 0) {
                    alert(`Se crearon ${recurringApts.length + 1} turnos.\n\nNo se pudieron agendar ${skipped.length} repeticiones porque el horario ya estaba ocupado:\n${skipped.join('\n')}`)
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
            setError(err?.code === '23P01'
                ? 'Ese horario se superpone con otro turno. Elegí otro.'
                : 'Error al crear el turno. Intentá de nuevo.')
        }
        setSaving(false)
    }

    function resetWizard() {
        setWizardStep(1)
        setNewApt({
            client_id: null,
            client_name: '',
            service_name: '',
            date: '',
            time: '',
            duration: DEFAULT_DURATION,
            team_member_id: profile?.role === 'Profesional' && currentMember ? currentMember.id : null
        })
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
            .select('id, time, duration, team_member_id, status')
            .eq('business_id', business.id)
            .eq('date', newApt.date)
            .not('status', 'in', '("cancelled","no_show")')

        if (newApt.team_member_id) {
            query = query.eq('team_member_id', newApt.team_member_id)
        }

        query.then(({ data, error: slotsErr }) => {
            // Sin este log, un fallo de permisos se vería como "el día está libre".
            if (slotsErr) console.error('[Calendar] Error leyendo la agenda del día:', slotsErr.message)
            setOccupiedSlots(toOccupiedRanges(data))
            setLoadingSlots(false)
        })
    }, [newApt.date, newApt.team_member_id, business?.id, showNewModal])

    // Mismos horarios que ve el cliente en la reserva pública.
    // El dueño sí puede agendar dentro de la antelación mínima (walk-ins).
    const availableSlots = useMemo(() => {
        const slots = generateAvailableSlots({
            settings: business?.settings,
            duration: newApt.duration || DEFAULT_DURATION,
            occupied: occupiedSlots,
            date: newApt.date,
            enforceMinAdvance: false,
        })
        // Si el dueño llegó acá clickeando una celda, respetamos esa hora exacta
        // aunque no caiga en la grilla estándar.
        if (newApt.time && !slots.includes(newApt.time)) {
            const start = timeToMinutes(newApt.time)
            const end = start + (newApt.duration || DEFAULT_DURATION)
            const free = !occupiedSlots.some(o => start < o.endMin && end > o.startMin)
            if (free) return [...slots, newApt.time].sort()
        }
        return slots
    }, [business?.settings, newApt.duration, newApt.date, newApt.time, occupiedSlots])

    const wizardWarning = useMemo(() => {
        if (!newApt.date) return null
        if (closureDates.includes(newApt.date)) return 'El negocio figura cerrado ese día.'
        if (!scheduleSettings.workDays.includes(new Date(newApt.date + 'T12:00:00').getDay())) {
            return 'Ese día de la semana está fuera del horario de atención.'
        }
        if (newApt.team_member_id) {
            const absent = teamAbsences.some(a =>
                a.team_member_id === newApt.team_member_id &&
                newApt.date >= a.start_date && newApt.date <= a.end_date
            )
            if (absent) return 'Ese profesional está de licencia en esa fecha.'
        }
        return null
    }, [newApt.date, newApt.team_member_id, closureDates, teamAbsences, scheduleSettings.workDays])

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

    const getAppointmentsForDay = useCallback((date) => {
        const dateStr = formatDate(date)
        return layoutDayAppointments(filteredAppointments.filter(a => a.date === dateStr))
    }, [filteredAppointments])

    // Click en un hueco: la hora sale de la posición vertical, redondeada al
    // intervalo configurado.
    function handleColumnClick(e, date) {
        const rect = e.currentTarget.getBoundingClientRect()
        const offsetY = e.clientY - rect.top
        const step = scheduleSettings.slotInterval || 15
        const rawMinutes = rangeStart + (offsetY / PX_PER_MIN)
        const snapped = Math.max(rangeStart, Math.round(rawMinutes / step) * step)
        resetWizard()
        setNewApt(prev => ({ ...prev, date: formatDate(date), time: minutesToTime(snapped) }))
        setWizardStep(1)
        setShowNewModal(true)
    }

    const statusColor = (status) => {
        const colors = { pending: '#F59E0B', confirmed: '#6366F1', completed: '#22C55E', cancelled: '#EF4444' }
        return colors[status] || '#9CA3AF'
    }

    function renderAppointmentBlock(apt, { compact = false } = {}) {
        const durationMin = apt.endMin - apt.startMin
        const heightPx = Math.max(durationMin, MIN_BLOCK_MINUTES) * PX_PER_MIN
        const widthPct = 100 / apt.columns
        return (
            <div
                key={apt.id}
                className={`${styles.aptBlock} ${durationMin < 30 ? styles.aptBlockTight : ''}`}
                style={{
                    top: (apt.startMin - rangeStart) * PX_PER_MIN,
                    height: heightPx - 2,
                    left: `calc(${apt.column * widthPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                    borderLeftColor: statusColor(apt.status),
                    background: `color-mix(in oklab, ${statusColor(apt.status)} 10%, var(--bg-card))`,
                }}
                title={`${apt.clients?.name || 'Cliente'} · ${apt.service_name || ''} · ${minutesToTime(apt.startMin)}–${minutesToTime(apt.endMin)} (${durationMin} min)`}
                onClick={(e) => {
                    e.stopPropagation()
                    handleOpenEdit(apt)
                }}
            >
                <span className={styles.aptBlockTime}>
                    {minutesToTime(apt.startMin)}–{minutesToTime(apt.endMin)}
                </span>
                <span className={styles.aptBlockName}>{apt.clients?.name || apt.service_name}</span>
                {!compact && durationMin >= 45 && (
                    <span className={styles.aptBlockService}>{apt.service_name} · {durationMin} min</span>
                )}
            </div>
        )
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

    const dayAppointments = getAppointmentsForDay(currentDate)

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

            {teamMembers.length > 0 && profile?.role !== 'Profesional' && (
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
                    <div className={styles.gridCanvas} style={{ height: canvasHeight }}>
                        <div className={styles.timeGutter}>
                            {hourMarks.map(m => (
                                <span key={m} className={styles.timeMark} style={{ top: (m - rangeStart) * PX_PER_MIN }}>
                                    {minutesToTime(m)}
                                </span>
                            ))}
                        </div>
                        {weekDates.map((date, i) => (
                            <div
                                key={i}
                                className={`${styles.dayColumn} ${formatDate(date) === today ? styles.dayColumnToday : ''}`}
                                onClick={(e) => handleColumnClick(e, date)}
                            >
                                {hourMarks.map(m => (
                                    <div key={`h-${m}`} className={styles.hourLine} style={{ top: (m - rangeStart) * PX_PER_MIN }} />
                                ))}
                                {halfHourMarks.map(m => (
                                    <div key={`hh-${m}`} className={styles.halfHourLine} style={{ top: (m - rangeStart) * PX_PER_MIN }} />
                                ))}
                                {getAppointmentsForDay(date).map(apt => renderAppointmentBlock(apt))}
                            </div>
                        ))}
                    </div>
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
                <div className={styles.mobileTimeline} style={{ height: canvasHeight }}>
                    <div className={styles.mobileGutter}>
                        {hourMarks.map(m => (
                            <span key={m} className={styles.timeMark} style={{ top: (m - rangeStart) * PX_PER_MIN }}>
                                {minutesToTime(m)}
                            </span>
                        ))}
                    </div>
                    <div className={styles.mobileColumn} onClick={(e) => handleColumnClick(e, currentDate)}>
                        {hourMarks.map(m => (
                            <div key={`h-${m}`} className={styles.hourLine} style={{ top: (m - rangeStart) * PX_PER_MIN }} />
                        ))}
                        {halfHourMarks.map(m => (
                            <div key={`hh-${m}`} className={styles.halfHourLine} style={{ top: (m - rangeStart) * PX_PER_MIN }} />
                        ))}
                        {dayAppointments.map(apt => renderAppointmentBlock(apt, { compact: false }))}
                        {dayAppointments.length === 0 && (
                            <p className={styles.mobileEmpty}>Sin turnos este día. Tocá para agendar.</p>
                        )}
                    </div>
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
                                                            <span className={styles.clientName}>Crear &ldquo;{clientSearch}&rdquo;</span>
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
                                                {services.map((svc) => (
                                                    <button
                                                        key={svc.id}
                                                        className={`${styles.serviceCard} ${newApt.service_name === svc.name ? styles.serviceCardSelected : ''}`}
                                                        onClick={() => {
                                                            setNewApt(prev => ({ ...prev, service_name: svc.name, duration: svc.duration }))
                                                            setWizardStep(3)
                                                        }}
                                                    >
                                                        <div className={styles.serviceCardTop}>
                                                            <span className={styles.serviceCardName}>{svc.name}</span>
                                                            {newApt.service_name === svc.name && <Check size={16} style={{ color: 'var(--accent)' }} />}
                                                        </div>
                                                        <div className={styles.serviceCardBottom}>
                                                            <span className={styles.serviceCardDuration}>
                                                                <Clock size={12} /> {svc.duration} min
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
                                                    {wizardWarning && (
                                                        <div className={styles.wizardWarning}>
                                                            <AlertTriangle size={14} /> {wizardWarning} Podés agendar igual.
                                                        </div>
                                                    )}

                                                    {teamMembers.length > 0 && profile?.role !== 'Profesional' && (
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

                                                    <label className="label" style={{ marginBottom: 'var(--space-2)' }}>
                                                        Horario <span className={styles.durationHint}>· bloques de {newApt.duration} min</span>
                                                    </label>
                                                    {loadingSlots ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                                                            <div className="loading-spinner" />
                                                        </div>
                                                    ) : availableSlots.length === 0 ? (
                                                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                                            No hay horarios disponibles para esta fecha. Probá otro día.
                                                        </p>
                                                    ) : (
                                                        <div className={styles.timeGrid}>
                                                            {availableSlots.map(slot => (
                                                                <button
                                                                    key={slot}
                                                                    className={`${styles.timeSlot} ${newApt.time === slot ? styles.timeSlotSelected : ''}`}
                                                                    onClick={() => {
                                                                        setNewApt(prev => ({ ...prev, time: slot }))
                                                                        setWizardStep(4)
                                                                    }}
                                                                >
                                                                    {slot}
                                                                    <span className={styles.timeSlotEnd}>
                                                                        {minutesToTime(timeToMinutes(slot) + (newApt.duration || DEFAULT_DURATION))}
                                                                    </span>
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
                                                    <span className={styles.summaryLabel}>Horario</span>
                                                    <span className={styles.summaryValue}>
                                                        {newApt.time} – {minutesToTime(timeToMinutes(newApt.time) + (newApt.duration || DEFAULT_DURATION))}
                                                    </span>
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
                                                    const svc = findServiceByName(services, newApt.service_name)
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

            {editingApt && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingApt(null)}>
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h3><Pencil size={16} /> Editar turno</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEditingApt(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {editError && (
                                <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                                    {editError}
                                </div>
                            )}
                            <div className="form-group">
                                <label className="label">Cliente</label>
                                <input className="input" type="text" value={editingApt.clients?.name || 'Cliente'} disabled />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                                <div className="form-group">
                                    <label className="label">Fecha</label>
                                    <input className="input" type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Hora</label>
                                    <input className="input" type="time" step="300" value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} required />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-2)' }}>
                                <div className="form-group">
                                    <label className="label">Servicio</label>
                                    <select
                                        className="input"
                                        value={editForm.service_name}
                                        onChange={e => {
                                            const svc = findServiceByName(services, e.target.value)
                                            setEditForm(p => ({
                                                ...p,
                                                service_name: e.target.value,
                                                duration: svc?.duration ?? p.duration,
                                            }))
                                        }}
                                        required
                                    >
                                        {/* El servicio del turno puede haberse borrado del catálogo */}
                                        {!findServiceByName(services, editForm.service_name) && editForm.service_name && (
                                            <option value={editForm.service_name}>{editForm.service_name} (fuera del catálogo)</option>
                                        )}
                                        {services.map(s => (
                                            <option key={s.id} value={s.name}>{s.name} · {s.duration} min</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Duración (min)</label>
                                    <input
                                        className="input" type="number" min="5" max="480" step="5"
                                        value={editForm.duration}
                                        onChange={e => setEditForm(p => ({ ...p, duration: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            {editForm.time && (
                                <p className={styles.editRangeHint}>
                                    <Clock size={12} /> Ocupa de {editForm.time} a {minutesToTime(timeToMinutes(editForm.time) + (parseInt(editForm.duration, 10) || DEFAULT_DURATION))}
                                </p>
                            )}
                            <div className="form-group">
                                <label className="label">Estado</label>
                                <select className="input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                                    {Object.values(APPOINTMENT_STATUS).map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">Notas</label>
                                <textarea className="input" rows={2} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Detalles o notas..." />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setEditingApt(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                                    {savingEdit ? <div className="loading-spinner" /> : 'Guardar cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
