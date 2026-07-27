'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { Check, X as XIcon, Plus, User, Pencil } from 'lucide-react'
import Link from 'next/link'
import ClientProfileCard from '@/components/ClientProfileCard'
import styles from './appointments.module.css'

export default function AppointmentsPage() {
    const { user, profile, business, loading: authLoading } = useAuth()
    const [selectedClientId, setSelectedClientId] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [filter, setFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
    const [loadingApts, setLoadingApts] = useState(true)
    const [currentMember, setCurrentMember] = useState(null)

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
                }
            } catch (err) {
                console.error('Error fetching employee details:', err)
            }
        }
        fetchCurrentMember()
    }, [user?.id, profile?.role])

    async function loadAppointments() {
        if (!supabase || !business?.id) return
        try {
            let query = supabase
                .from('appointments')
                .select('*, clients(name, phone), team_members(name)')
                .eq('business_id', business.id)

            if (profile?.role === 'Profesional') {
                let memberId = currentMember?.id
                if (!memberId) {
                    const { data } = await supabase
                        .from('team_members')
                        .select('id')
                        .eq('user_id', user.id)
                        .maybeSingle()
                    if (data) {
                        setCurrentMember(data)
                        memberId = data.id
                    }
                }
                if (memberId) {
                    query = query.eq('team_member_id', memberId)
                } else {
                    setAppointments([])
                    setLoadingApts(false)
                    return
                }
            }

            query = query
                .order('date', { ascending: true })
                .order('time', { ascending: true })

            if (dateFilter) query = query.eq('date', dateFilter)
            if (filter !== 'all') query = query.eq('status', filter)

            const { data, error } = await query.limit(50)
            if (error) throw error
            setAppointments(data || [])
        } catch (err) {
            console.error('Error loading appointments:', err)
        } finally {
            setLoadingApts(false)
        }
    }

    useEffect(() => {
        if (business?.id) loadAppointments()
    }, [business?.id, dateFilter, filter, currentMember])

    async function updateStatus(id, status) {
        if (!supabase) return
        await supabase.from('appointments').update({ status }).eq('id', id)

        if (status === 'cancelled') {
            const apt = appointments.find(a => a.id === id)
            if (apt?.client_id) {
                try {
                    const currentMonth = new Date().toISOString().slice(0, 7)
                    const { data: clientInfo } = await supabase
                        .from('clients')
                        .select('monthly_cancellations, last_cancellation_month')
                        .eq('id', apt.client_id)
                        .single()
                    if (clientInfo) {
                        const count = clientInfo.last_cancellation_month === currentMonth
                            ? (clientInfo.monthly_cancellations || 0) + 1
                            : 1
                        await supabase.from('clients')
                            .update({ monthly_cancellations: count, last_cancellation_month: currentMonth })
                            .eq('id', apt.client_id)
                    }
                } catch (_) {}
            }
        }

        if (status === 'completed') {
            const apt = appointments.find(a => a.id === id)
            if (apt) {
                // Use price stored on appointment first, then fall back to service lookup
                let price = apt.price
                if (!price) {
                    // Fetch services fresh from DB
                    const { data: bizData } = await supabase
                        .from('businesses')
                        .select('services')
                        .eq('id', business.id)
                        .single()
                    const svcList = Array.isArray(bizData?.services) ? bizData.services : []
                    const service = svcList.find(s => s.name === apt.service_name)
                    price = service?.price
                }
                if (price) {
                    await supabase.from('transactions').insert([{
                        business_id: business.id,
                        type: 'income',
                        concept: `${apt.service_name} — ${apt.clients?.name || 'Cliente'}`,
                        amount: price,
                        payment_method: 'cash',
                    }])
                }

                // Request review from client (non-blocking)
                if (apt.clients?.email) {
                    fetch('/api/reviews/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            appointment_id: id,
                            client_email: apt.clients.email,
                            client_name: apt.clients.name,
                            service_name: apt.service_name,
                            business_id: business.id,
                            business_name: business.name,
                            business_type: business.business_type,
                        }),
                    }).catch(() => {})
                }
            }
        }
        loadAppointments()
    }

    const statusBadge = (status) => {
        const s = Object.values(APPOINTMENT_STATUS).find(a => a.id === status)
        return s ? <span className={`badge badge-${s.color}`}>{s.label}</span> : null
    }

    const [editingApt, setEditingApt] = useState(null)
    const [editForm, setEditForm] = useState({ date: '', time: '', service_name: '', notes: '', status: '' })
    const [savingEdit, setSavingEdit] = useState(false)

    function handleOpenEdit(apt) {
        setEditingApt(apt)
        setEditForm({
            date: apt.date || '',
            time: apt.time?.slice(0, 5) || '',
            service_name: apt.service_name || '',
            notes: apt.notes || '',
            status: apt.status || 'pending',
        })
    }

    async function handleSaveEdit(e) {
        e.preventDefault()
        if (!editingApt) return
        setSavingEdit(true)
        try {
            const res = await fetch(`/api/appointments/${editingApt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al guardar')
            setEditingApt(null)
            loadAppointments()
        } catch (err) {
            alert(err.message || 'Error al guardar los cambios')
        } finally {
            setSavingEdit(false)
        }
    }

    const renderActions = (apt) => (
        <div className={styles.statusActions}>
            <button className="btn btn-ghost btn-sm" title="Editar turno" onClick={() => handleOpenEdit(apt)}>
                <Pencil size={14} /> Editar
            </button>
            {apt.status === 'pending' && (
                <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(apt.id, 'confirmed')}>
                    <Check size={14} />
                </button>
            )}
            {(apt.status === 'confirmed' || apt.status === 'pending') && (
                <>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }}
                        onClick={() => updateStatus(apt.id, 'completed')}><Check size={14} /> Completar</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                        onClick={() => updateStatus(apt.id, 'cancelled')}><XIcon size={14} /></button>
                </>
            )}
        </div>
    )

    if (authLoading || !business?.id) {
        return (
            <div className={styles.appointments}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.appointments}>
            <div className={styles.header}>
                <h1>Turnos</h1>
                <div className={styles.headerActions}>
                    <input type="date" className="input input-sm" style={{ width: 160 }} value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)} />
                    <Link href="/dashboard/calendar" className="btn btn-primary"><Plus size={16} /> Nuevo turno</Link>
                </div>
            </div>

            <div className={styles.tabsWrap}>
                <div className="tabs">
                    {[{ id: 'all', label: 'Todos' }, ...Object.values(APPOINTMENT_STATUS)].map(s => (
                        <button key={s.id} className={`tab ${filter === s.id ? 'active' : ''}`}
                            onClick={() => setFilter(s.id)}>{s.label}</button>
                    ))}
                </div>
            </div>

            {/* Desktop: Table */}
            <div className={styles.tableWrap}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Cliente</th>
                                <th>Servicio</th>
                                <th className="hide-mobile">Profesional</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingApts ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '60px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <div className="loading-spinner" style={{ width: '28px', height: '28px' }} />
                                        </div>
                                    </td>
                                </tr>
                            ) : appointments.length === 0 ? (
                                <tr><td colSpan={6} className={styles.emptyState}>No hay turnos para esta fecha</td></tr>
                            ) : appointments.map(apt => (
                                <tr key={apt.id}>
                                    <td style={{ fontWeight: 600 }}>{apt.time?.slice(0, 5)}</td>
                                    <td>
                                        <span style={{ cursor: apt.client_id ? 'pointer' : 'default', textDecoration: apt.client_id ? 'underline' : 'none' }}
                                            onClick={() => apt.client_id && setSelectedClientId(selectedClientId === apt.client_id ? null : apt.client_id)}>
                                            {apt.clients?.name || '—'}
                                        </span>
                                    </td>
                                    <td>{apt.service_name}</td>
                                    <td className="hide-mobile">{apt.team_members?.name || '—'}</td>
                                    <td>{statusBadge(apt.status)}</td>
                                    <td>{renderActions(apt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile: Card list */}
            <div className={styles.cardList}>
                {loadingApts ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <div className="loading-spinner" style={{ width: '28px', height: '28px' }} />
                    </div>
                ) : appointments.length === 0 ? (
                    <div className={`card ${styles.emptyState}`}>No hay turnos para esta fecha</div>
                ) : appointments.map(apt => (
                    <div key={apt.id} className={`card ${styles.aptCard}`}>
                        <div className={styles.aptCardTime}>
                            <span className={styles.aptCardHour}>{apt.time?.slice(0, 5)}</span>
                        </div>
                        <div className={styles.aptCardBody}>
                            <span className={styles.aptCardClient} style={{ cursor: apt.client_id ? 'pointer' : 'default', textDecoration: apt.client_id ? 'underline' : 'none' }}
                                onClick={() => apt.client_id && setSelectedClientId(selectedClientId === apt.client_id ? null : apt.client_id)}>
                                {apt.clients?.name || 'Cliente'}
                            </span>
                            <span className={styles.aptCardService}>{apt.service_name}</span>
                            <div className={styles.aptCardMeta}>
                                {statusBadge(apt.status)}
                                {apt.team_members?.name && (
                                    <span className="badge badge-neutral">{apt.team_members.name}</span>
                                )}
                            </div>
                            <div className={styles.aptCardActions}>
                                {renderActions(apt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedClientId && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedClientId(null)}>
                    <div className="modal" style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3><User size={16} /> Perfil del cliente</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setSelectedClientId(null)}><XIcon size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <ClientProfileCard clientId={selectedClientId} businessId={business.id} />
                        </div>
                    </div>
                </div>
            )}

            {editingApt && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingApt(null)}>
                    <div className="modal" style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h3><Pencil size={16} /> Editar turno</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEditingApt(null)}><XIcon size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
                                    <input className="input" type="time" value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="label">Servicio</label>
                                <input className="input" type="text" value={editForm.service_name} onChange={e => setEditForm(p => ({ ...p, service_name: e.target.value }))} required />
                            </div>
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
