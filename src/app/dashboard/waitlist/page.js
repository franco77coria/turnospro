'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { BellRing, Phone, Calendar, Trash2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'

export default function WaitlistPage() {
    return (
        <PermissionGate permission={PERMISSIONS.VIEW_APPOINTMENTS}>
            <WaitlistContent />
        </PermissionGate>
    )
}

function WaitlistContent() {
    const toast = useToast()
    const { business } = useAuth()
    const [entries, setEntries] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('pending') // pending | notified | all

    async function loadEntries() {
        setLoading(true)
        let query = supabase
            .from('waitlist')
            .select('*')
            .eq('business_id', business.id)
            .order('date', { ascending: true })

        if (filter === 'pending') query = query.eq('notified', false)
        if (filter === 'notified') query = query.eq('notified', true)

        const { data } = await query
        setEntries(data || [])
        setLoading(false)
    }

    useEffect(() => {
        if (!business?.id || !supabase) return
        loadEntries()
    }, [business?.id, filter])

    async function deleteEntry(id) {
        await supabase.from('waitlist').delete().eq('id', id)
        setEntries(prev => prev.filter(e => e.id !== id))
        toast.success('Entrada eliminada')
    }

    return (
        <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Lista de espera</h1>
                <div className="tabs">
                    {[
                        { key: 'pending', label: 'Pendientes' },
                        { key: 'notified', label: 'Notificados' },
                        { key: 'all', label: 'Todos' },
                    ].map(t => (
                        <button key={t.key} className={`tab ${filter === t.key ? 'active' : ''}`}
                            onClick={() => setFilter(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            ) : entries.length === 0 ? (
                <div className="empty-state">
                    <BellRing />
                    <h3>Sin entradas en la lista</h3>
                    <p>Cuando un cliente solicite ser avisado al liberarse un turno, aparecera aqui.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Fecha</th>
                                <th>Servicio</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => (
                                <tr key={entry.id}>
                                    <td>
                                        <div>
                                            <strong style={{ fontSize: 'var(--font-size-sm)' }}>{entry.client_name || 'Sin nombre'}</strong>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                <Phone size={10} /> {entry.client_phone}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-sm)' }}>
                                            <Calendar size={14} />
                                            {new Date(entry.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 'var(--font-size-sm)' }}>{entry.service_name || '—'}</td>
                                    <td>
                                        <span className={`badge ${entry.notified ? 'badge-success' : 'badge-warning'}`}>
                                            {entry.notified ? 'Notificado' : 'Esperando'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => deleteEntry(entry.id)}
                                            title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
