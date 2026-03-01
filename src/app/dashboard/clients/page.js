'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Plus, X, Search, Trash2 } from 'lucide-react'
import styles from './clients.module.css'

export default function ClientsPage() {
    const { business, loading: authLoading } = useAuth()
    const [clients, setClients] = useState([])
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editClient, setEditClient] = useState(null)
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
    const [loadingClients, setLoadingClients] = useState(true)

    useEffect(() => {
        if (business?.id) loadClients()
    }, [business?.id])

    async function loadClients() {
        if (!supabase) return
        const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('business_id', business.id)
            .order('name')
        setClients(data || [])
        setLoadingClients(false)
    }

    async function handleSave(e) {
        e.preventDefault()
        if (!supabase) return
        try {
            if (editClient) {
                await supabase.from('clients').update(form).eq('id', editClient.id)
            } else {
                await supabase.from('clients').insert([{ ...form, business_id: business.id }])
            }
            setShowModal(false)
            setEditClient(null)
            setForm({ name: '', phone: '', email: '', notes: '' })
            loadClients()
        } catch (err) { console.error('Error:', err) }
    }

    async function handleDelete(clientId) {
        if (!supabase) return
        const confirmed = window.confirm('¿Estás seguro de que querés eliminar este cliente? Esta acción no se puede deshacer.')
        if (!confirmed) return
        try {
            await supabase.from('appointments').delete().eq('client_id', clientId)
            await supabase.from('clients').delete().eq('id', clientId)
            setShowModal(false)
            setEditClient(null)
            loadClients()
        } catch (err) { console.error('Error al eliminar:', err) }
    }

    const openEdit = (c) => {
        setEditClient(c)
        setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' })
        setShowModal(true)
    }

    const filtered = search
        ? clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
        : clients

    if (authLoading || !business?.id || loadingClients) {
        return (
            <div className={styles.clients}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.clients}>
            <div className={styles.header}>
                <div>
                    <h1>Clientes</h1>
                    <p className={styles.subtitle}>{clients.length} clientes registrados</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditClient(null)
                    setForm({ name: '', phone: '', email: '', notes: '' })
                    setShowModal(true)
                }}><Plus size={16} /> Agregar cliente</button>
            </div>

            <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input className={`input ${styles.searchInput}`} placeholder="Buscar por nombre o telefono..." value={search}
                    onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Desktop: Table */}
            <div className={styles.tableWrap}>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Telefono</th>
                                <th className="hide-mobile">Email</th>
                                <th className="hide-mobile">Notas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} className={styles.emptyState}>
                                    {search ? 'Sin resultados' : 'No hay clientes aun'}
                                </td></tr>
                            ) : filtered.map(c => (
                                <tr key={c.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <div className="avatar avatar-sm">{c.name?.[0]?.toUpperCase()}</div>
                                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                                        </div>
                                    </td>
                                    <td>{c.phone || '—'}</td>
                                    <td className="hide-mobile">{c.email || '—'}</td>
                                    <td className="hide-mobile" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</td>
                                    <td>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile: Card list */}
            <div className={styles.cardList}>
                {filtered.length === 0 ? (
                    <div className={`card ${styles.emptyState}`}>
                        {search ? 'Sin resultados' : 'No hay clientes aun'}
                    </div>
                ) : filtered.map(c => (
                    <div key={c.id} className={`card card-compact ${styles.clientCard}`} onClick={() => openEdit(c)}>
                        <div className="avatar">{c.name?.[0]?.toUpperCase()}</div>
                        <div className={styles.clientCardBody}>
                            <span className={styles.clientCardName}>{c.name}</span>
                            {c.phone && <span className={styles.clientCardPhone}>{c.phone}</span>}
                            {c.email && <span className={styles.clientCardEmail}>{c.email}</span>}
                            {c.notes && <span className={styles.clientCardNotes}>{c.notes}</span>}
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editClient ? 'Editar cliente' : 'Nuevo cliente'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="label">Nombre *</label>
                                    <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Telefono</label>
                                    <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Email</label>
                                    <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Notas</label>
                                    <textarea className="input textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas sobre el cliente..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                {editClient && (
                                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => handleDelete(editClient.id)}>
                                        <Trash2 size={14} /> Eliminar
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
