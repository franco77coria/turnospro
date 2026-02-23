'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { Plus, X, Search } from 'lucide-react'

export default function ClientsPage() {
    const { business } = useAuth()
    const [clients, setClients] = useState([])
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editClient, setEditClient] = useState(null)
    const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })

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

    const filtered = search
        ? clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
        : clients

    return (
        <div style={{ maxWidth: 1200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Clientes</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{clients.length} clientes registrados</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditClient(null)
                    setForm({ name: '', phone: '', email: '', notes: '' })
                    setShowModal(true)
                }}><Plus size={16} /> Agregar cliente</button>
            </div>

            <div style={{ position: 'relative', maxWidth: 400, marginBottom: 'var(--space-4)' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input className="input" placeholder="Buscar por nombre o teléfono..." value={search}
                    onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th className="hide-mobile">Email</th>
                            <th className="hide-mobile">Notas</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                                {search ? 'Sin resultados' : 'No hay clientes aún'}
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
                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                        setEditClient(c)
                                        setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' })
                                        setShowModal(true)
                                    }}>Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                                    <label className="label">Teléfono</label>
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
