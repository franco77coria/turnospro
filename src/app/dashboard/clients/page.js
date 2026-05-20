'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Plus, X, Search, Trash2, AlertTriangle, Tag } from 'lucide-react'
import styles from './clients.module.css'

export default function ClientsPage() {
    const { business, loading: authLoading } = useAuth()
    const [clients, setClients] = useState([])
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editClient, setEditClient] = useState(null)
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', tags: [], preferences: {} })
    const [tagInput, setTagInput] = useState('')
    const [loadingClients, setLoadingClients] = useState(true)

    async function loadClients() {
        if (!supabase) return
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('business_id', business.id)
                .order('name')
            if (error) throw error
            setClients(data || [])
        } catch (err) {
            console.error('Error loading clients:', err)
        } finally {
            setLoadingClients(false)
        }
    }

    useEffect(() => {
        if (business?.id) loadClients()
    }, [business?.id])

    async function handleSave(e) {
        e.preventDefault()
        if (!supabase) return
        try {
            if (editClient) {
                await supabase.from('clients').update(form).eq('id', editClient.id)
            } else {
                // Check for existing client by email or phone to prevent duplicates
                if (form.email) {
                    const existing = clients.find(c => c.email?.toLowerCase() === form.email.toLowerCase())
                    if (existing) {
                        alert(`Ya existe un cliente con ese email: ${existing.name}`)
                        return
                    }
                }
                if (form.phone) {
                    const existing = clients.find(c => c.phone === form.phone)
                    if (existing) {
                        alert(`Ya existe un cliente con ese telefono: ${existing.name}`)
                        return
                    }
                }
                await supabase.from('clients').insert([{ ...form, business_id: business.id }])
            }
            setShowModal(false)
            setEditClient(null)
            setForm({ name: '', phone: '', email: '', notes: '', tags: [], preferences: {} })
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
        setForm({
            name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '',
            tags: Array.isArray(c.tags) ? c.tags : [],
            preferences: c.preferences && typeof c.preferences === 'object' ? c.preferences : {},
        })
        setTagInput('')
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
                    setForm({ name: '', phone: '', email: '', notes: '', tags: [], preferences: {} })
                    setTagInput('')
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
                                <th className="hide-mobile">Tags</th>
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
                                    <td>
                                        {c.phone || '—'}
                                        {(() => {
                                            const cm = new Date().toISOString().slice(0, 7)
                                            const mc = c.last_cancellation_month === cm ? (c.monthly_cancellations || 0) : 0
                                            return mc >= 2 ? <span className="badge badge-warning" style={{ marginLeft: 'var(--space-1)', fontSize: '0.65rem' }} title={`${mc} cancelaciones este mes`}><AlertTriangle size={10} /> {mc}</span> : null
                                        })()}
                                    </td>
                                    <td className="hide-mobile">{c.email || '—'}</td>
                                    <td className="hide-mobile">
                                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', maxWidth: 200 }}>
                                            {Array.isArray(c.tags) && c.tags.map(t => <span key={t} className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{t}</span>)}
                                            {(!c.tags || c.tags.length === 0) && <span>—</span>}
                                        </div>
                                    </td>
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
                            {Array.isArray(c.tags) && c.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
                                    {c.tags.map(t => <span key={t} className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{t}</span>)}
                                </div>
                            )}
                            {(() => {
                                const cm = new Date().toISOString().slice(0, 7)
                                const mc = c.last_cancellation_month === cm ? (c.monthly_cancellations || 0) : 0
                                return mc >= 2 ? <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginTop: 'var(--space-1)' }}><AlertTriangle size={10} /> {mc} cancelaciones</span> : null
                            })()}
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
                                <div className="form-group">
                                    <label className="label"><Tag size={12} /> Tags</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
                                        {form.tags.map(tag => (
                                            <span key={tag} className="badge badge-accent" style={{ cursor: 'pointer' }}
                                                onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))}>
                                                {tag} <X size={10} />
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
                                            placeholder="Ej: VIP, frecuente..." onKeyDown={e => {
                                                if (e.key === 'Enter' && tagInput.trim()) {
                                                    e.preventDefault()
                                                    if (!form.tags.includes(tagInput.trim())) {
                                                        setForm(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }))
                                                    }
                                                    setTagInput('')
                                                }
                                            }} />
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                                            if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
                                                setForm(p => ({ ...p, tags: [...p.tags, tagInput.trim()] }))
                                                setTagInput('')
                                            }
                                        }}>+</button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="label">Preferencias</label>
                                    <input className="input" placeholder="Ej: Corte preferido"
                                        value={form.preferences?.favorite || ''}
                                        onChange={e => setForm(p => ({ ...p, preferences: { ...p.preferences, favorite: e.target.value } }))} />
                                    <input className="input" placeholder="Ej: Producto que usa" style={{ marginTop: 'var(--space-2)' }}
                                        value={form.preferences?.product || ''}
                                        onChange={e => setForm(p => ({ ...p, preferences: { ...p.preferences, product: e.target.value } }))} />
                                    <input className="input" placeholder="Ej: Alergias o sensibilidades" style={{ marginTop: 'var(--space-2)' }}
                                        value={form.preferences?.allergy || ''}
                                        onChange={e => setForm(p => ({ ...p, preferences: { ...p.preferences, allergy: e.target.value } }))} />
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
