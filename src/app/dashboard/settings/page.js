'use client'
import { useAuth } from '@/context/AuthContext'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import { useState, useEffect } from 'react'
import { Save, Trash2, Plus, X, Calendar, Clock, Shield, Link2, Copy, Check, Download, UserX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'
import { useToast } from '@/components/Toast'

export default function SettingsPage() {
    return (
        <PermissionGate permission={PERMISSIONS.EDIT_SETTINGS}>
            <SettingsContent />
        </PermissionGate>
    )
}

function SettingsContent() {
    const toast = useToast()
    const { business, updateBusiness, profile, loading: authLoading } = useAuth()
    const [form, setForm] = useState({
        name: '',
        phone: '',
        address: '',
        business_type: '',
        description: '',
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    // Work hours
    const [workHoursForm, setWorkHoursForm] = useState({
        start: '09:00',
        end: '20:00',
    })

    // Work days (0=Sunday, 1=Monday, ..., 6=Saturday)
    const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5, 6])

    // Cancellation policy
    const [minCancelHours, setMinCancelHours] = useState(2)

    // Buffer time between appointments (minutes)
    const [bufferTime, setBufferTime] = useState(0)

    // Deposit Configuration (percentage, 0 = no deposit)
    const [depositPercentage, setDepositPercentage] = useState(0)

    // Min advance booking (hours)
    const [minAdvance, setMinAdvance] = useState(1)

    // Max advance booking (days)
    const [maxAdvance, setMaxAdvance] = useState(30)

    // Closed dates (holidays/special days)
    const [closedDates, setClosedDates] = useState([])
    const [newClosedDate, setNewClosedDate] = useState('')
    const [newClosedReason, setNewClosedReason] = useState('')

    // Team absences
    const [teamMembers, setTeamMembers] = useState([])
    const [teamAbsences, setTeamAbsences] = useState([])
    const [newAbsence, setNewAbsence] = useState({ team_member_id: '', start_date: '', end_date: '', reason: '' })

    // Load team members and absences
    useEffect(() => {
        if (!business?.id || !supabase) return
        supabase.from('team_members').select('id, name').eq('business_id', business.id).eq('active', true)
            .then(({ data }) => setTeamMembers(data || []))
        supabase.from('team_absences').select('*').eq('business_id', business.id)
            .gte('end_date', new Date().toISOString().split('T')[0])
            .order('start_date')
            .then(({ data }) => setTeamAbsences(data || []))
    }, [business?.id])

    useEffect(() => {
        if (business) {
            // eslint-disable-next-line
            setForm({
                name: business.name || '',
                phone: business.phone || '',
                address: business.address || '',
                business_type: business.business_type || '',
                description: business.settings?.description || '',
            })
            setWorkHoursForm({
                start: business.settings?.work_hours?.start || '09:00',
                end: business.settings?.work_hours?.end || '20:00',
            })
            setWorkDays(business.settings?.work_days || [1, 2, 3, 4, 5, 6])
            setMinCancelHours(business.settings?.min_cancel_hours ?? 2)
            setBufferTime(business.settings?.buffer_time ?? 0)
            setDepositPercentage(business.settings?.deposit_percentage ?? 0)
            setMinAdvance(business.settings?.min_advance_hours ?? 1)
            setMaxAdvance(business.settings?.max_advance_days ?? 30)
            setClosedDates(business.settings?.closed_dates || [])
        }
    }, [business?.id, business?.name, business?.phone, business?.address, business?.business_type, business?.settings])

    const toggleWorkDay = (day) => {
        setWorkDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
        )
    }

    const addClosedDate = () => {
        if (!newClosedDate) return
        const exists = closedDates.some(d => d.date === newClosedDate)
        if (exists) return
        setClosedDates(prev => [...prev, { date: newClosedDate, reason: newClosedReason || 'Cerrado' }])
        setNewClosedDate('')
        setNewClosedReason('')
    }

    const removeClosedDate = (index) => {
        setClosedDates(prev => prev.filter((_, i) => i !== index))
    }

    const addTeamAbsence = async () => {
        if (!newAbsence.team_member_id || !newAbsence.start_date || !newAbsence.end_date) return
        if (!supabase) return
        const { data, error } = await supabase.from('team_absences').insert([{
            team_member_id: newAbsence.team_member_id,
            business_id: business.id,
            start_date: newAbsence.start_date,
            end_date: newAbsence.end_date,
            reason: newAbsence.reason || 'Ausencia',
        }]).select().single()
        if (!error && data) {
            setTeamAbsences(prev => [...prev, data])
            setNewAbsence({ team_member_id: '', start_date: '', end_date: '', reason: '' })
            toast.success('Ausencia registrada')
        } else {
            toast.error('Error al registrar ausencia')
        }
    }

    const removeTeamAbsence = async (id) => {
        if (!supabase) return
        await supabase.from('team_absences').delete().eq('id', id)
        setTeamAbsences(prev => prev.filter(a => a.id !== id))
        toast.success('Ausencia eliminada')
    }

    const handleCopyLink = () => {
        const url = business.slug
            ? `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/book/s/${business.slug}`
            : `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/book/${business.id}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            await updateBusiness({
                name: form.name,
                phone: form.phone,
                address: form.address,
                settings: {
                    ...business?.settings,
                    description: form.description,
                    work_hours: workHoursForm,
                    work_days: workDays,
                    min_cancel_hours: parseInt(minCancelHours) || 2,
                    buffer_time: parseInt(bufferTime) || 0,
                    deposit_percentage: parseInt(depositPercentage) || 0,
                    min_advance_hours: parseInt(minAdvance) || 1,
                    max_advance_days: parseInt(maxAdvance) || 30,
                    closed_dates: closedDates,
                }
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error(err)
            setError('Error al guardar. Intentá de nuevo.')
        }
        setSaving(false)
    }

    const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

    if (authLoading || !business?.id) {
        return (
            <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '0 var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
                    <div className="loading-spinner" style={{ width: '40px', height: '40px' }} />
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '0 var(--space-4) var(--space-8) var(--space-4)' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)', fontFamily: 'var(--font-display)', color: 'var(--cream)' }}>Configuración</h1>

            <form onSubmit={handleSave}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
                    gap: '24px',
                    alignItems: 'start'
                }}>
                    {/* COLUMNA IZQUIERDA: Información del Negocio y Horarios */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Business Info */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--cream)' }}>Datos del negocio</h3>
                            <div className="form-group">
                                <label className="label">Nombre del negocio</label>
                                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="label">Rubro</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
                                    <span style={{ fontWeight: 500, color: 'var(--pink)' }}>{BUSINESS_TEMPLATES[form.business_type]?.name || 'No definido'}</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Descripción</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    placeholder="Describí tu negocio para tus clientes..."
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                    style={{ resize: 'vertical', minHeight: 80 }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="label">Teléfono</label>
                                <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="label">Dirección</label>
                                <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                            </div>
                        </div>

                        {/* Work Schedule */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <Clock size={18} /> Horario de atención
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="label">Apertura</label>
                                    <input className="input" type="time" value={workHoursForm.start}
                                        onChange={e => setWorkHoursForm(p => ({ ...p, start: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Cierre</label>
                                    <input className="input" type="time" value={workHoursForm.end}
                                        onChange={e => setWorkHoursForm(p => ({ ...p, end: e.target.value }))} />
                                </div>
                            </div>

                            {/* Work Days */}
                            <div className="form-group" style={{ marginTop: 'var(--space-3)' }}>
                                <label className="label">Días de trabajo</label>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                    {DAY_NAMES.map((name, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleWorkDay(idx)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid ' + (workDays.includes(idx) ? 'var(--pink)' : 'var(--line)'),
                                                background: workDays.includes(idx) ? 'var(--pink)' : 'var(--bg-card)',
                                                color: workDays.includes(idx) ? 'white' : 'var(--cream)',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all var(--t-fast)',
                                            }}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Booking Link & QR Code */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <Link2 size={18} /> Link de reservas y Código QR
                            </h3>
                            
                            {/* Link */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                                <input className="input" value={
                                    business.slug
                                        ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/s/${business.slug}`
                                        : `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${business.id}`
                                } readOnly style={{ opacity: 0.8 }} />
                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyLink}
                                    style={{ whiteSpace: 'nowrap', minWidth: 80 }}>
                                    {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                                </button>
                            </div>

                            {/* QR Code */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}>
                                <div id="booking-qr-code" style={{ padding: 'var(--space-2)', background: 'white', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                                    <QRCodeSVG 
                                        value={
                                            business.slug
                                                ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/s/${business.slug}`
                                                : `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${business.id}`
                                        } 
                                        size={100} 
                                        level="M" 
                                        includeMargin={false}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--space-1)', color: 'var(--cream)' }}>Código QR de reservas</h4>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 60%, transparent)', marginBottom: 'var(--space-2)', lineHeight: 1.4 }}>
                                        Imprimí este código para que tus clientes puedan escanear y reservar directamente.
                                    </p>
                                    <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                                        const svg = document.getElementById('booking-qr-code').innerHTML;
                                        const blob = new Blob([svg], { type: 'image/svg+xml' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `qr-glowup-${business.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }}>
                                        <Download size={12} /> Descargar QR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Embeddable Widget */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <Link2 size={18} /> Widget para tu sitio web
                            </h3>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'color-mix(in oklab, var(--cream) 60%, transparent)', marginBottom: 'var(--space-4)' }}>
                                Copiá y pegá este código HTML en tu página web (WordPress, Wix, etc.) para integrar el botón de reservas.
                            </p>
                            <div style={{ position: 'relative' }}>
                                <textarea 
                                    className="input" 
                                    readOnly 
                                    rows={3}
                                    style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: 'rgba(0,0,0,0.2)', resize: 'none' }}
                                    value={`<iframe src="${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${business.slug || business.id}?widget=true" width="100%" height="600" frameborder="0" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>`}
                                />
                                <button type="button" className="btn btn-secondary btn-sm" 
                                    style={{ position: 'absolute', top: '10px', right: '10px' }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`<iframe src="${process.env.NEXT_PUBLIC_APP_URL || ''}/book/${business.slug || business.id}?widget=true" width="100%" height="600" frameborder="0" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>`);
                                        toast.success('Código copiado');
                                    }}>
                                    <Copy size={14} /> Copiar
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: Políticas, Feriados y Cuenta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Booking Settings */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <Shield size={18} /> Políticas de turnos
                            </h3>

                            <div className="form-group">
                                <label className="label">Horas mínimas para cancelar</label>
                                <input className="input" type="number" min="0" max="72" value={minCancelHours}
                                    onChange={e => setMinCancelHours(e.target.value)} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                    Los clientes no podrán cancelar con menos de {minCancelHours}h de anticipación
                                </span>
                            </div>

                            <div className="form-group">
                                <label className="label">Tiempo buffer entre turnos (minutos)</label>
                                <input className="input" type="number" min="0" max="60" step="5" value={bufferTime}
                                    onChange={e => setBufferTime(e.target.value)} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                    Descanso o preparación entre turno y turno
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="label">Anticipación mínima (horas)</label>
                                    <input className="input" type="number" min="0" max="168" value={minAdvance}
                                        onChange={e => setMinAdvance(e.target.value)} />
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                        No se puede reservar con menos de {minAdvance}h antes
                                    </span>
                                </div>
                                <div className="form-group">
                                    <label className="label">Anticipación máxima (días)</label>
                                    <input className="input" type="number" min="1" max="365" value={maxAdvance}
                                        onChange={e => setMaxAdvance(e.target.value)} />
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                        Pueden reservar hasta {maxAdvance} días adelante
                                    </span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px dashed var(--line)' }}>
                                <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                    <Shield size={14} color="var(--pink)" /> Seña / Depósito Requerido (%)
                                </label>
                                <input className="input" type="number" min="0" max="100" value={depositPercentage}
                                    onChange={e => setDepositPercentage(e.target.value)} />
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                    Porcentaje que el cliente debe pagar por adelantado para confirmar el turno (0 = no requiere seña)
                                </span>
                            </div>
                        </div>

                        {/* Closed Dates (Holidays) */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <Calendar size={18} /> Días cerrados / Feriados
                            </h3>

                            {closedDates.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                    {closedDates.map((cd, i) => {
                                        const dateObj = new Date(cd.date + 'T12:00:00')
                                        return (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: 'var(--space-2) var(--space-3)',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 'var(--font-size-sm)',
                                                border: '1px solid var(--line)'
                                            }}>
                                                <span style={{ color: 'var(--cream)' }}>
                                                    <strong>{dateObj.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                                                    {cd.reason && <span style={{ color: 'color-mix(in oklab, var(--cream) 50%, transparent)', marginLeft: 8 }}>— {cd.reason}</span>}
                                                </span>
                                                <button type="button" onClick={() => removeClosedDate(i)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #DC2626)', padding: 4 }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: '1 1 140px' }}>
                                    <label className="label">Fecha</label>
                                    <input className="input" type="date" value={newClosedDate}
                                        onChange={e => setNewClosedDate(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ flex: '2 1 180px' }}>
                                    <label className="label">Motivo (opcional)</label>
                                    <input className="input" placeholder="Ej: Feriado, Vacaciones..."
                                        value={newClosedReason} onChange={e => setNewClosedReason(e.target.value)} />
                                </div>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addClosedDate}
                                    style={{ height: 40, whiteSpace: 'nowrap' }}>
                                    <Plus size={14} /> Agregar
                                </button>
                            </div>
                        </div>

                        {/* Team Absences */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--cream)' }}>
                                <UserX size={18} /> Ausencias del equipo
                            </h3>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 60%, transparent)', marginBottom: 'var(--space-4)' }}>
                                Registra vacaciones o ausencias. Esos días no aparecerán disponibles para reservas.
                            </p>

                            {teamAbsences.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                                    {teamAbsences.map(abs => {
                                        const member = teamMembers.find(m => m.id === abs.team_member_id)
                                        const start = new Date(abs.start_date + 'T12:00:00')
                                        const end = new Date(abs.end_date + 'T12:00:00')
                                        return (
                                            <div key={abs.id} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: 'var(--space-2) var(--space-3)',
                                                background: 'rgba(255, 184, 0, 0.1)',
                                                border: '1px solid rgba(255, 184, 0, 0.3)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 'var(--font-size-sm)',
                                                color: 'var(--cream)'
                                            }}>
                                                <span>
                                                    <strong>{member?.name || 'Profesional'}</strong>
                                                    <span style={{ color: 'color-mix(in oklab, var(--cream) 60%, transparent)', marginLeft: 8 }}>
                                                        {start.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} — {end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    {abs.reason && abs.reason !== 'Ausencia' && (
                                                        <span style={{ color: 'color-mix(in oklab, var(--cream) 50%, transparent)', marginLeft: 8 }}>({abs.reason})</span>
                                                    )}
                                                </span>
                                                <button type="button" onClick={() => removeTeamAbsence(abs.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {teamMembers.length > 0 ? (
                                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div className="form-group" style={{ flex: '1 1 160px' }}>
                                        <label className="label">Profesional</label>
                                        <select className="select" value={newAbsence.team_member_id}
                                            onChange={e => setNewAbsence(p => ({ ...p, team_member_id: e.target.value }))}>
                                            <option value="">Seleccionar...</option>
                                            {teamMembers.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 110px' }}>
                                        <label className="label">Desde</label>
                                        <input className="input" type="date" value={newAbsence.start_date}
                                            onChange={e => setNewAbsence(p => ({ ...p, start_date: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 110px' }}>
                                        <label className="label">Hasta</label>
                                        <input className="input" type="date" value={newAbsence.end_date}
                                            onChange={e => setNewAbsence(p => ({ ...p, end_date: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 120px' }}>
                                        <label className="label">Motivo</label>
                                        <input className="input" placeholder="Vacaciones..." value={newAbsence.reason}
                                            onChange={e => setNewAbsence(p => ({ ...p, reason: e.target.value }))} />
                                    </div>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={addTeamAbsence}
                                        style={{ height: 40, whiteSpace: 'nowrap' }}>
                                        <Plus size={14} /> Agregar
                                    </button>
                                </div>
                            ) : (
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 50%, transparent)' }}>
                                    No hay miembros del equipo. Agrega profesionales en la sección Equipo.
                                </p>
                            )}
                        </div>

                        {/* Account Info */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--cream)' }}>Mi cuenta</h3>
                            <div className="form-group">
                                <label className="label">Email</label>
                                <input className="input" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Rol</label>
                                <div style={{ marginTop: '4px' }}>
                                    <span className="badge badge-accent" style={{ background: 'var(--pink)', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                                        {profile?.role || 'Dueño'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="card" style={{ borderColor: 'var(--danger)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--danger)', marginBottom: 'var(--space-2)' }}>Zona peligrosa</h3>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'color-mix(in oklab, var(--cream) 60%, transparent)', marginBottom: 'var(--space-4)' }}>
                                Estas acciones son irreversibles.
                            </p>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => toast.info('Esta función no está disponible aún. Contactá al administrador.')}><Trash2 size={14} /> Eliminar negocio</button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', margin: 'var(--space-4) 0', fontSize: 'var(--font-size-sm)' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                    <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '350px', fontWeight: 700, borderRadius: 'var(--radius-md)' }} disabled={saving}>
                        {saving ? <div className="loading-spinner" /> : saved ? '✓ Guardado' : <><Save size={16} /> Guardar cambios</>}
                    </button>
                </div>
            </form>
        </div>
    )
}
