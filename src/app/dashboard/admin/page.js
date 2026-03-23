'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { isSuperAdmin } from '@/lib/superadmin'
import { Check, X, Clock, Store, User, RefreshCw } from 'lucide-react'

export default function AdminApprovalsPage() {
    const { user } = useAuth()
    const [accounts, setAccounts] = useState([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    async function loadAccounts() {
        if (!supabase) return
        setLoading(true)
        setError('')

        try {
            // Query all profiles — requires superadmin RLS policy
            const { data, error: queryError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (queryError) {
                console.error('Error loading accounts:', queryError)
                setError('Error al cargar cuentas. Verificá que las políticas RLS permitan al superadmin ver todos los perfiles.')
                setAccounts([])
            } else {
                setAccounts(data || [])
            }
        } catch (err) {
            console.error('Exception loading accounts:', err)
            setError('Error de conexión al cargar cuentas.')
            setAccounts([])
        }
        setLoading(false)
    }

    useEffect(() => {
        if (user && isSuperAdmin(user.email)) {
            loadAccounts()
        }
    }, [user])

    async function handleApprove(profileId) {
        if (!supabase) return
        try {
            await supabase.from('profiles').update({ approved: true }).eq('id', profileId)
            loadAccounts()
        } catch (err) {
            console.error('Error approving:', err)
        }
    }

    async function handleReject(profileId) {
        if (!supabase) return
        if (!confirm('¿Rechazar esta solicitud? El usuario no podrá acceder.')) return
        try {
            await supabase.from('profiles').delete().eq('id', profileId)
            loadAccounts()
        } catch (err) {
            console.error('Error rejecting:', err)
        }
    }

    if (!user || !isSuperAdmin(user.email)) {
        return (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No tenés permisos para ver esta página.</p>
            </div>
        )
    }

    const pendingAccounts = accounts.filter(a => a.approved === false)
    const displayList = filter === 'pending' ? pendingAccounts : accounts

    return (
        <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Aprobaciones</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {accounts.length} cuentas registradas · {pendingAccounts.length} pendientes
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadAccounts}>
                    <RefreshCw size={14} /> Actualizar
                </button>
            </div>

            {error && (
                <div style={{ background: 'var(--warning-light)', color: '#92400E', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    ⚠️ {error}
                    <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
                        Ejecutá el script <code>fix-schema.sql</code> en el SQL Editor de Supabase para habilitar esta funcionalidad.
                    </p>
                </div>
            )}

            <div className="tabs" style={{ marginBottom: 'var(--space-4)' }}>
                <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                    Todas ({accounts.length})
                </button>
                <button className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
                    <Clock size={14} /> Pendientes ({pendingAccounts.length})
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>Cargando cuentas...</p>
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
                                <th className="hide-mobile">Email</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Acciones</th>
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
                                            <span style={{ fontWeight: 500 }}>{account.full_name || 'Sin nombre'}</span>
                                        </div>
                                    </td>
                                    <td className="hide-mobile" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                        {account.email}
                                    </td>
                                    <td>
                                        <span className="badge badge-accent">{account.role || '—'}</span>
                                    </td>
                                    <td>
                                        {account.approved === false ? (
                                            <span className="badge badge-warning">Pendiente</span>
                                        ) : (
                                            <span className="badge badge-success">Activo</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            {account.approved === false && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleApprove(account.id)}>
                                                    <Check size={14} /> Aprobar
                                                </button>
                                            )}
                                            {!isSuperAdmin(account.email) && (
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                                    onClick={() => handleReject(account.id)}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
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
