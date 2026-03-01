'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { Check, X as XIcon, Plus } from 'lucide-react'
import styles from './appointments.module.css'

export default function AppointmentsPage() {
    const { business } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [filter, setFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        if (business?.id) loadAppointments()
    }, [business?.id, dateFilter, filter])

    async function loadAppointments() {
        if (!supabase) return
        let query = supabase
            .from('appointments')
            .select('*, clients(name, phone), team_members(name)')
            .eq('business_id', business.id)
            .order('date', { ascending: true })
            .order('time', { ascending: true })

        if (dateFilter) query = query.eq('date', dateFilter)
        if (filter !== 'all') query = query.eq('status', filter)

        const { data } = await query.limit(50)
        setAppointments(data || [])
    }

    async function updateStatus(id, status) {
        if (!supabase) return
        await supabase.from('appointments').update({ status }).eq('id', id)

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
            }
        }
        loadAppointments()
    }

    const statusBadge = (status) => {
        const s = Object.values(APPOINTMENT_STATUS).find(a => a.id === status)
        return s ? <span className={`badge badge-${s.color}`}>{s.label}</span> : null
    }

    const renderActions = (apt) => (
        <div className={styles.statusActions}>
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

    return (
        <div className={styles.appointments}>
            <div className={styles.header}>
                <h1>Turnos</h1>
                <div className={styles.headerActions}>
                    <input type="date" className="input input-sm" style={{ width: 160 }} value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)} />
                    <a href="/dashboard/calendar" className="btn btn-primary"><Plus size={16} /> Nuevo turno</a>
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
                            {appointments.length === 0 ? (
                                <tr><td colSpan={6} className={styles.emptyState}>No hay turnos para esta fecha</td></tr>
                            ) : appointments.map(apt => (
                                <tr key={apt.id}>
                                    <td style={{ fontWeight: 600 }}>{apt.time?.slice(0, 5)}</td>
                                    <td>{apt.clients?.name || '—'}</td>
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
                {appointments.length === 0 ? (
                    <div className={`card ${styles.emptyState}`}>No hay turnos para esta fecha</div>
                ) : appointments.map(apt => (
                    <div key={apt.id} className={`card ${styles.aptCard}`}>
                        <div className={styles.aptCardTime}>
                            <span className={styles.aptCardHour}>{apt.time?.slice(0, 5)}</span>
                        </div>
                        <div className={styles.aptCardBody}>
                            <span className={styles.aptCardClient}>{apt.clients?.name || 'Cliente'}</span>
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
        </div>
    )
}
