'use client'
import { useAuth } from '@/context/AuthContext'
import { useState, useEffect } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'

export default function ServicesPage() {
    const { business, updateBusiness } = useAuth()
    const [services, setServices] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editIdx, setEditIdx] = useState(-1)
    const [form, setForm] = useState({ name: '', price: '', duration: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Always sync from business context
    useEffect(() => {
        if (business?.services && Array.isArray(business.services)) {
            setServices(business.services)
        }
    }, [business])

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        setSaving(true)
        try {
            const newService = {
                name: form.name.trim(),
                price: parseFloat(form.price),
                duration: parseInt(form.duration)
            }
            let updated
            if (editIdx >= 0) {
                updated = [...services]
                updated[editIdx] = newService
            } else {
                updated = [...services, newService]
            }

            const result = await updateBusiness({ services: updated })
            if (result) {
                setServices(result.services || updated)
            } else {
                setServices(updated)
            }
            setShowModal(false)
            setEditIdx(-1)
            setForm({ name: '', price: '', duration: '' })
        } catch (err) {
            console.error('Error saving service:', err)
            setError('Error al guardar. Intentá de nuevo.')
        }
        setSaving(false)
    }

    async function handleDelete(idx) {
        if (!confirm('¿Eliminar este servicio?')) return
        try {
            const updated = services.filter((_, i) => i !== idx)
            const result = await updateBusiness({ services: updated })
            if (result) {
                setServices(result.services || updated)
            } else {
                setServices(updated)
            }
        } catch (err) {
            console.error('Error deleting service:', err)
            setError('Error al eliminar.')
        }
    }

    return (
        <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Servicios</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{services.length} servicios configurados</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditIdx(-1)
                    setForm({ name: '', price: '', duration: '' })
                    setError('')
                    setShowModal(true)
                }}><Plus size={14} /> Agregar servicio</button>
            </div>

            {error && (
                <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {services.map((s, i) => (
                    <div key={i} className="card card-compact" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{s.duration} min</div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 'var(--font-size-lg)' }}>
                            ${s.price?.toLocaleString()}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                setEditIdx(i)
                                setForm({ name: s.name, price: s.price.toString(), duration: s.duration.toString() })
                                setError('')
                                setShowModal(true)
                            }}>Editar</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(i)}>Eliminar</button>
                        </div>
                    </div>
                ))}

                {services.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>
                        <p style={{ marginBottom: 'var(--space-3)' }}>No hay servicios configurados</p>
                        <p style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)' }}>
                            Agregá al menos un servicio para poder crear turnos
                        </p>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                            setForm({ name: '', price: '', duration: '' })
                            setError('')
                            setShowModal(true)
                        }}><Plus size={14} /> Agregar servicio</button>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editIdx >= 0 ? 'Editar servicio' : 'Nuevo servicio'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && (
                                    <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                        {error}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="label">Nombre *</label>
                                    <input className="input" placeholder="Ej: Corte Clásico" value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="label">Precio ($) *</label>
                                        <input className="input" type="number" placeholder="2500" value={form.price}
                                            onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required min="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Duración (min) *</label>
                                        <input className="input" type="number" placeholder="30" value={form.duration}
                                            onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} required min="1" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <div className="loading-spinner" /> : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
