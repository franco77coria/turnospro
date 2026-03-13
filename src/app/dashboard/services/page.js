'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Tag } from 'lucide-react'
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
    const { business, updateBusiness } = useAuth()
    const [services, setServices] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editIdx, setEditIdx] = useState(-1)
    const [form, setForm] = useState({ name: '', price: '', duration: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loadingServices, setLoadingServices] = useState(true)

    // Load services directly from DB (not from context) to avoid stale data
    const loadServices = useCallback(async () => {
        if (!supabase || !business?.id) {
            setLoadingServices(false)
            return
        }
        try {
            const { data } = await supabase
                .from('businesses')
                .select('services')
                .eq('id', business.id)
                .single()
            setServices(Array.isArray(data?.services) ? data.services : [])
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
            // Read fresh services from DB before modifying
            const { data: freshBiz } = await supabase
                .from('businesses')
                .select('services')
                .eq('id', business.id)
                .single()

            const currentServices = Array.isArray(freshBiz?.services) ? freshBiz.services : []

            const editingService = editIdx >= 0 ? services[editIdx] : null
            const newService = {
                id: editingService?.id || crypto.randomUUID(),
                name: form.name.trim(),
                price: parseFloat(form.price),
                duration: parseInt(form.duration)
            }

            let updated
            if (editingService?.id) {
                // Update by ID
                updated = currentServices.map(s => s.id === editingService.id ? newService : s)
            } else if (editIdx >= 0) {
                updated = [...currentServices]
                if (updated[editIdx]) {
                    updated[editIdx] = newService
                } else {
                    updated.push(newService)
                }
            } else {
                updated = [...currentServices, newService]
            }

            const { data: result, error: updateError } = await supabase
                .from('businesses')
                .update({ services: updated })
                .eq('id', business.id)
                .select()
                .single()

            if (updateError) throw updateError

            setServices(result.services || updated)
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
        setError('')
        try {
            // Read fresh services from DB before deleting
            const { data: freshBiz } = await supabase
                .from('businesses')
                .select('services')
                .eq('id', business.id)
                .single()

            const currentServices = Array.isArray(freshBiz?.services) ? freshBiz.services : []
            const serviceToDelete = services[idx]

            // Delete by ID (most reliable), fallback to name matching
            let updated
            if (serviceToDelete?.id) {
                updated = currentServices.filter(s => s.id !== serviceToDelete.id)
            } else if (serviceToDelete?.name) {
                let found = false
                updated = currentServices.filter(s => {
                    if (!found && s.name === serviceToDelete.name) {
                        found = true
                        return false
                    }
                    return true
                })
            } else {
                updated = currentServices.filter((_, i) => i !== idx)
            }

            const { data: result, error: updateError } = await supabase
                .from('businesses')
                .update({ services: updated })
                .eq('id', business.id)
                .select()
                .single()

            if (updateError) throw updateError

            setServices(result.services || updated)
        } catch (err) {
            console.error('Error deleting service:', err)
            setError('Error al eliminar.')
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
                    setEditIdx(-1)
                    setForm({ name: '', price: '', duration: '' })
                    setError('')
                    setShowModal(true)
                }}><Plus size={14} /> Agregar servicio</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.serviceList}>
                {services.map((s, i) => (
                    <div key={s.id || `${s.name}-${i}`} className={`card card-compact ${styles.serviceCard}`}>
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
