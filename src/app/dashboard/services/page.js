'use client'
import { useAuth } from '@/context/AuthContext'
import { useState, useEffect } from 'react'
import { Plus, X, Tag } from 'lucide-react'
import styles from './services.module.css'

export default function ServicesPage() {
    const { business, updateBusiness } = useAuth()
    const [services, setServices] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editIdx, setEditIdx] = useState(-1)
    const [form, setForm] = useState({ name: '', price: '', duration: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

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
            setError('Error al guardar. Intenta de nuevo.')
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
        <div className={styles.services}>
            <div className={styles.header}>
                <div>
                    <h1>Servicios</h1>
                    <p className={styles.subtitle}>{services.length} servicios configurados</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditIdx(-1)
                    setForm({ name: '', price: '', duration: '' })
                    setError('')
                    setShowModal(true)
                }}><Plus size={14} /> Agregar servicio</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.serviceList}>
                {services.map((s, i) => (
                    <div key={i} className={`card card-compact ${styles.serviceCard}`}>
                        <div className={styles.serviceInfo}>
                            <span className={styles.serviceName}>{s.name}</span>
                            <span className={styles.serviceDuration}>{s.duration} min</span>
                        </div>
                        <div className={styles.servicePrice}>
                            ${s.price?.toLocaleString()}
                        </div>
                        <div className={styles.serviceActions}>
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
                    <div className={`card ${styles.emptyState}`}>
                        <div className={styles.emptyIcon}>
                            <Tag size={24} />
                        </div>
                        <p>No hay servicios configurados</p>
                        <p className={styles.emptyHint}>
                            Agrega al menos un servicio para poder crear turnos
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
                                {error && <div className={styles.error}>{error}</div>}
                                <div className="form-group">
                                    <label className="label">Nombre *</label>
                                    <input className="input" placeholder="Ej: Corte Clasico" value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className={styles.formGrid}>
                                    <div className="form-group">
                                        <label className="label">Precio ($) *</label>
                                        <input className="input" type="number" placeholder="2500" value={form.price}
                                            onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required min="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Duracion (min) *</label>
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
