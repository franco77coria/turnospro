'use client'
import { useAuth } from '@/context/AuthContext'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import { useState } from 'react'
import { Save, Trash2 } from 'lucide-react'

export default function SettingsPage() {
    const { business, updateBusiness, profile } = useAuth()
    const [form, setForm] = useState({
        name: business?.name || '',
        phone: business?.phone || '',
        address: business?.address || '',
        business_type: business?.business_type || '',
    })
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleSave(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await updateBusiness(form)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) { console.error(err) }
        setSaving(false)
    }

    const workHours = business?.settings?.work_hours || { start: '09:00', end: '20:00' }

    return (
        <div style={{ maxWidth: 600 }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-6)' }}>Configuración</h1>

            <form onSubmit={handleSave}>
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Datos del negocio</h3>
                    <div className="form-group">
                        <label className="label">Nombre del negocio</label>
                        <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="label">Rubro</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 0' }}>
                            <span style={{ fontWeight: 500 }}>{BUSINESS_TEMPLATES[form.business_type]?.name || 'No definido'}</span>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="label">Teléfono</label>
                        <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="label">Dirección</label>
                        <input className="input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Horario de atención</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div className="form-group">
                            <label className="label">Apertura</label>
                            <input className="input" type="time" defaultValue={workHours.start} />
                        </div>
                        <div className="form-group">
                            <label className="label">Cierre</label>
                            <input className="input" type="time" defaultValue={workHours.end} />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Mi cuenta</h3>
                    <div className="form-group">
                        <label className="label">Email</label>
                        <input className="input" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div className="form-group">
                        <label className="label">Rol</label>
                        <span className="badge badge-accent">{profile?.role || 'Dueño'}</span>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={saving}>
                    {saving ? <div className="loading-spinner" /> : saved ? 'Guardado' : <><Save size={16} /> Guardar cambios</>}
                </button>
            </form>

            <div className="card" style={{ marginTop: 'var(--space-5)', borderColor: 'var(--danger)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--danger)', marginBottom: 'var(--space-2)' }}>Zona peligrosa</h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                    Estas acciones son irreversibles.
                </p>
                <button className="btn btn-danger btn-sm"><Trash2 size={14} /> Eliminar negocio</button>
            </div>
        </div>
    )
}
