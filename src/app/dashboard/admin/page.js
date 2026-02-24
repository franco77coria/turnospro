'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { isSuperAdmin } from '@/lib/superadmin'
import { Check, X, Clock, Store, User } from 'lucide-react'

export default function AdminApprovalsPage() {
    const { user } = useAuth()
    const [pendingAccounts, setPendingAccounts] = useState([])
    const [allAccounts, setAllAccounts] = useState([])
    const [filter, setFilter] = useState('pending')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user && isSuperAdmin(user.email)) {
            loadAccounts()
        }
    }, [user])

    async function loadAccounts() {
        if (!supabase) return
        setLoading(true)

        const { data: pending } = await supabase
            .from('profiles')
            .select('*')
            .eq('account_type', 'business')
            .eq('approved', false)
            .order('created_at', { ascending: false })

        const { data: all } = await supabase
            .from('profiles')
            .select('*')
            .neq('account_type', 'superadmin')
            .order('created_at', { ascending: false })

        setPendingAccounts(pending || [])
        setAllAccounts(all || [])
        setLoading(false)
    }

    async function handleApprove(profileId) {
        if (!supabase) return
        await supabase.from('profiles').update({ approved: true }).eq('id', profileId)
        loadAccounts()
    }

    async function handleReject(profileId) {
        if (!supabase) return
        if (!confirm('¿Rechazar esta solicitud? El usuario no podrá acceder.')) return
        await supabase.from('profiles').delete().eq('id', profileId)
        loadAccounts()
    }

    if (!user || !isSuperAdmin(user.email)) {
        return (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No tenés permisos para ver esta página.</p>
            </div>
        )
    }

    const displayList = filter === 'pending' ? pendingAccounts : allAccounts

    return (
        <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Aprobaciones</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {pendingAccounts.length} solicitudes pendientes
                    </p>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
                <button className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
                    <Clock size={14} /> Pendientes ({pendingAccounts.length})
                </button>
                <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                    Todas las cuentas ({allAccounts.length})
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="loading-spinner" />
                </div>
            ) : displayList.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                    {filter === 'pending' ? 'No hay solicitudes pendientes' : 'No hay cuentas registradas'}
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Tipo</th>
                                <th className="hide-mobile">Negocio</th>
                                <th>Estado</th>
                                {filter === 'pending' && <th>Acciones</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {displayList.map(account => (
                                <tr key={account.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <div className="avatar avatar-sm">
                                                {account.full_name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{account.full_name || 'Sin nombre'}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                    {account.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${account.account_type === 'business' ? 'badge-accent' : 'badge-neutral'}`}>
                                            {account.account_type === 'business' ? (
                                                <><Store size={10} /> Negocio</>
                                            ) : (
                                                <><User size={10} /> Cliente</>
                                            )}
                                        </span>
                                    </td>
                                    <td className="hide-mobile">
                                        {account.business_name || '—'}
                                    </td>
                                    <td>
                                        {account.approved ? (
                                            <span className="badge badge-success">Aprobado</span>
                                        ) : (
                                            <span className="badge badge-warning">Pendiente</span>
                                        )}
                                    </td>
                                    {filter === 'pending' && (
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button className="btn btn-primary btn-sm" onClick={() => handleApprove(account.id)}>
                                                    <Check size={14} /> Aprobar
                                                </button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                                    onClick={() => handleReject(account.id)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
