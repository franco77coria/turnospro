'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { Check, X as XIcon, Plus } from 'lucide-react'

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
                const service = business?.services?.find(s => s.name === apt.service_name)
                if (service?.price) {
                    await supabase.from('transactions').insert([{
                        business_id: business.id,
                        type: 'income',
                        concept: `${apt.service_name} — ${apt.clients?.name || 'Cliente'}`,
                        amount: service.price,
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

    return (
        <div style={{ maxWidth: 1200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Turnos</h1>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <input type="date" className="input input-sm" style={{ width: 160 }} value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)} />
                    <a href="/dashboard/calendar" className="btn btn-primary"><Plus size={16} /> Nuevo turno</a>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
                {[{ id: 'all', label: 'Todos' }, ...Object.values(APPOINTMENT_STATUS)].map(s => (
                    <button key={s.id} className={`tab ${filter === s.id ? 'active' : ''}`}
                        onClick={() => setFilter(s.id)}>{s.label}</button>
                ))}
            </div>

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
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>No hay turnos para esta fecha</td></tr>
                        ) : appointments.map(apt => (
                            <tr key={apt.id}>
                                <td style={{ fontWeight: 600 }}>{apt.time?.slice(0, 5)}</td>
                                <td>{apt.clients?.name || '—'}</td>
                                <td>{apt.service_name}</td>
                                <td className="hide-mobile">{apt.team_members?.name || '—'}</td>
                                <td>{statusBadge(apt.status)}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
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
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
