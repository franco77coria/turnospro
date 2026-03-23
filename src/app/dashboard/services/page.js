'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Tag, GripVertical } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'
import styles from './services.module.css'

export default function ServicesPage() {
    return (
        <PermissionGate permission={PERMISSIONS.EDIT_SERVICES}>
            <ServicesContent />
        </PermissionGate>
    )
}

function ServicesContent() {
    const { business } = useAuth()
    const [services, setServices] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editService, setEditService] = useState(null)
    const [form, setForm] = useState({ name: '', price: '', duration: '', category: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loadingServices, setLoadingServices] = useState(true)

    // Load services from the `services` table
    const loadServices = useCallback(async () => {
        if (!supabase || !business?.id) {
            setLoadingServices(false)
            return
        }
        try {
            const { data, error: loadErr } = await supabase
                .from('services')
                .select('*')
                .eq('business_id', business.id)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: true })

            if (loadErr) {
                // Fallback to JSONB if services table doesn't exist yet
                console.warn('Services table not ready, falling back to JSONB:', loadErr.message)
                const { data: bizData } = await supabase
                    .from('businesses')
                    .select('services')
                    .eq('id', business.id)
                    .single()
                setServices(Array.isArray(bizData?.services) ? bizData.services : [])
            } else {
                setServices(data || [])
            }
        } catch (err) {
            console.error('Error loading services:', err)
        }
        setLoadingServices(false)
    }, [business?.id])

    useEffect(() => {
        loadServices()
    }, [loadServices])

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        setSaving(true)
        try {
            const serviceData = {
                name: form.name.trim(),
                price: parseFloat(form.price),
                duration: parseInt(form.duration),
                category: form.category.trim() || null,
                description: form.description.trim() || null,
                business_id: business.id,
            }

            if (editService?.id) {
                // Update existing
                const { error: updateErr } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', editService.id)

                if (updateErr) throw updateErr
            } else {
                // Insert new
                serviceData.sort_order = services.length
                const { error: insertErr } = await supabase
                    .from('services')
                    .insert([serviceData])

                if (insertErr) throw insertErr
            }

            setShowModal(false)
            setEditService(null)
            setForm({ name: '', price: '', duration: '', category: '', description: '' })
            loadServices()
        } catch (err) {
            console.error('Error saving service:', err)
            setError('Error al guardar. Intentá de nuevo.')
        }
        setSaving(false)
    }

    async function handleDelete(service) {
        if (!confirm(`¿Eliminar "${service.name}"?`)) return
        setError('')
        try {
            if (service.id && typeof service.id === 'string' && service.id.includes('-')) {
                // UUID = from services table
                const { error: delErr } = await supabase
                    .from('services')
                    .delete()
                    .eq('id', service.id)
                if (delErr) throw delErr
            }
            loadServices()
        } catch (err) {
            console.error('Error deleting service:', err)
            setError('Error al eliminar.')
        }
    }

    async function toggleActive(service) {
        try {
            await supabase
                .from('services')
                .update({ active: !service.active })
                .eq('id', service.id)
            loadServices()
        } catch (err) {
            console.error('Error toggling service:', err)
        }
    }

    if (loadingServices) {
        return (
            <div className={styles.services}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.services}>
            <div className={styles.header}>
                <div>
                    <h1>Servicios</h1>
                    <p className={styles.subtitle}>{services.length} servicios configurados</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditService(null)
                    setForm({ name: '', price: '', duration: '', category: '', description: '' })
                    setError('')
                    setShowModal(true)
                }}><Plus size={14} /> Agregar servicio</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.serviceList}>
                {services.map((s) => (
                    <div key={s.id || s.name} className={`card card-compact ${styles.serviceCard}`} style={{ opacity: s.active === false ? 0.5 : 1 }}>
                        <div className={styles.serviceInfo}>
                            <span className={styles.serviceName}>{s.name}</span>
                            <span className={styles.serviceDuration}>
                                {s.duration} min
                                {s.category && <> · <span style={{ color: 'var(--accent)' }}>{s.category}</span></>}
                            </span>
                        </div>
                        <div className={styles.servicePrice}>
                            ${s.price?.toLocaleString()}
                        </div>
                        <div className={styles.serviceActions}>
                            {s.active === false && (
                                <span className="badge badge-neutral" style={{ marginRight: 'var(--space-2)' }}>Inactivo</span>
                            )}
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                                setEditService(s)
                                setForm({
                                    name: s.name,
                                    price: s.price?.toString() || '',
                                    duration: s.duration?.toString() || '',
                                    category: s.category || '',
                                    description: s.description || '',
                                })
                                setError('')
                                setShowModal(true)
                            }}>Editar</button>
                            {s.active !== false ? (
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-tertiary)' }} onClick={() => toggleActive(s)}>Desactivar</button>
                            ) : (
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => toggleActive(s)}>Activar</button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s)}>Eliminar</button>
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
                            Agregá al menos un servicio para poder crear turnos
                        </p>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                            setForm({ name: '', price: '', duration: '', category: '', description: '' })
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
                            <h3>{editService ? 'Editar servicio' : 'Nuevo servicio'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className={styles.error}>{error}</div>}
                                <div className="form-group">
                                    <label className="label">Nombre *</label>
                                    <input className="input" placeholder="Ej: Corte Clásico" value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className={styles.formGrid}>
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
                                <div className="form-group">
                                    <label className="label">Categoría</label>
                                    <input className="input" placeholder="Ej: Cortes, Coloración, Tratamientos" value={form.category}
                                        onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Descripción</label>
                                    <textarea className="input textarea" placeholder="Descripción opcional del servicio" value={form.description}
                                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
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
