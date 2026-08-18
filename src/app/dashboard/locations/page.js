'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Plus, MapPin, Building, X, Trash2 } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'
import { useToast } from '@/components/Toast'

export default function LocationsPage() {
    return (
        <PermissionGate permission={PERMISSIONS.EDIT_SETTINGS}>
            <LocationsContent />
        </PermissionGate>
    )
}

function LocationsContent() {
    const toast = useToast()
    const { business, loading: authLoading } = useAuth()
    const [locations, setLocations] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editLocation, setEditLocation] = useState(null)
    const [form, setForm] = useState({ name: '', address: '', phone: '', active: true, is_primary: false })
    const [saving, setSaving] = useState(false)

    const loadLocations = useCallback(async () => {
        if (!supabase) return
        setLoading(true)
        try {
            const { data } = await supabase
                .from('locations')
                .select('*')
                .eq('business_id', business.id)
                .order('is_primary', { ascending: false })
                .order('created_at')
            setLocations(data || [])
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }, [business])

    useEffect(() => {
        if (business) loadLocations()
    }, [business, loadLocations])

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        try {
            // If this is set as primary, unset others
            if (form.is_primary) {
                await supabase.from('locations')
                    .update({ is_primary: false })
                    .eq('business_id', business.id)
                    .neq('id', editLocation?.id || '00000000-0000-0000-0000-000000000000') // just need a fake uuid if new
            }

            if (editLocation) {
                await supabase.from('locations').update(form).eq('id', editLocation.id)
            } else {
                await supabase.from('locations').insert([{ ...form, business_id: business.id }])
            }
            setShowModal(false)
            setEditLocation(null)
            loadLocations()
        } catch (err) {
            console.error('Error saving location:', err)
            toast.error('Error al guardar sucursal')
        }
        setSaving(false)
    }

    async function handleDelete(locId) {
        if (!confirm('¿Seguro que querés eliminar esta sucursal?')) return
        try {
            await supabase.from('locations').delete().eq('id', locId)
            loadLocations()
        } catch (err) {
            console.error(err)
            toast.error('Error al eliminar')
        }
    }

    function openEdit(loc) {
        setEditLocation(loc)
        setForm({
            name: loc.name,
            address: loc.address || '',
            phone: loc.phone || '',
            active: loc.active,
            is_primary: loc.is_primary
        })
        setShowModal(true)
    }

    function openNew() {
        const planId = business?.plan_id || 'trial'
        const maxLocations = business?.max_locations || (planId === 'multi' ? 3 : 1)

        if (locations.length >= maxLocations) {
            if (maxLocations < 3) {
                toast.info('Tu plan actual permite 1 sucursal. Actualizá a Plan Múltiples Sucursales ($30.000/mes) para habilitar hasta 3 sucursales.')
            } else {
                toast.info('Has alcanzado el límite de 3 sucursales de tu plan. Contactanos para solicitar un Plan Personalizado.')
            }
            return
        }

        setEditLocation(null)
        // If it's the first one, default to primary
        setForm({ name: '', address: '', phone: '', active: true, is_primary: locations.length === 0 })
        setShowModal(true)
    }

    if (authLoading || loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}><div className="loading-spinner" /></div>
    }

    return (
        <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Sucursales</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestioná las diferentes ubicaciones de tu negocio.</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <Plus size={16} /> Agregar Sucursal
                </button>
            </div>

            {locations.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                        <Building size={32} />
                    </div>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No tenés sucursales</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Agregá tu primera sucursal para que los clientes sepan dónde encontrarte.</p>
                    <button className="btn btn-primary" onClick={openNew}>
                        <Plus size={16} /> Crear Sucursal
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {locations.map(loc => (
                        <div key={loc.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5)', opacity: loc.active ? 1 : 0.6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: loc.is_primary ? 'var(--accent-subtle)' : 'var(--bg-secondary)', color: loc.is_primary ? 'var(--accent)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MapPin size={24} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{loc.name}</h3>
                                        {loc.is_primary && <span className="badge badge-accent">Sede Principal</span>}
                                        {!loc.active && <span className="badge badge-neutral">Inactiva</span>}
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 4 }}>
                                        {loc.address || 'Sin dirección'} {loc.phone && `• ${loc.phone}`}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(loc)}>Editar</button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(loc.id)} style={{ color: 'var(--danger)' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editLocation ? 'Editar Sucursal' : 'Nueva Sucursal'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="label">Nombre (Ej: Sede Palermo) *</label>
                                    <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Dirección</label>
                                    <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Teléfono</label>
                                    <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                                
                                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={form.is_primary} onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))} />
                                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Es la sede principal</span>
                                    </label>
                                    
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Sede Activa</span>
                                    </label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar Sucursal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
