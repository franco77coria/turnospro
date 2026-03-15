'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Gift, Percent, CreditCard, ToggleLeft, ToggleRight } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'

export default function MarketingPage() {
    return (
        <PermissionGate permission={PERMISSIONS.MANAGE_MARKETING}>
            <MarketingContent />
        </PermissionGate>
    )
}

function MarketingContent() {
    const { business } = useAuth()
    const [coupons, setCoupons] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ 
        code: '', 
        discount_type: 'percentage', 
        discount_value: '',
        max_uses: '',
        active: true 
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const loadCoupons = useCallback(async () => {
        if (!business?.id) return
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('business_id', business.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCoupons(data || [])
        } catch (err) {
            console.error('Error load coupons:', err)
        }
        setLoading(false)
    }, [business?.id])

    useEffect(() => {
        loadCoupons()
    }, [loadCoupons])

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        setSaving(true)
        try {
            const val = parseFloat(form.discount_value)
            const max = form.max_uses ? parseInt(form.max_uses) : null
            const code = form.code.trim().toUpperCase()
            
            if (!code) throw new Error('Código es requerido')
            if (isNaN(val) || val <= 0) throw new Error('Valor inválido')
            if (form.discount_type === 'percentage' && val > 100) throw new Error('El porcentaje no puede ser mayor a 100')

            const payload = {
                business_id: business.id,
                code: code,
                discount_type: form.discount_type,
                discount_value: val,
                max_uses: max,
                active: form.active
            }

            const { error: insErr } = await supabase
                .from('coupons')
                .insert([payload])

            if (insErr) {
                if (insErr.code === '23505') throw new Error('Ya existe un cupón con este código.')
                throw insErr
            }

            await loadCoupons()
            setShowModal(false)
            setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', active: true })
        } catch (err) {
            console.error('Error saving coupon:', err)
            setError(err.message || 'Error al guardar el cupón')
        }
        setSaving(false)
    }

    async function toggleActive(coupon) {
        try {
            const { error } = await supabase
                .from('coupons')
                .update({ active: !coupon.active })
                .eq('id', coupon.id)
            if (error) throw error
            setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, active: !coupon.active } : c))
        } catch (err) {
            console.error(err)
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Eliminar definitivamente este cupón?')) return
        try {
            await supabase
                .from('coupons')
                .delete()
                .eq('id', id)
            setCoupons(p => p.filter(x => x.id !== id))
        } catch (err) {
            console.error(err)
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                <div className="loading-spinner" />
            </div>
        )
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Marketing y Cupones</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>Gestioná descuentos para fidelizar clientes</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', active: true })
                    setError('')
                    setShowModal(true)
                }}>
                    <Plus size={14} /> Nuevo Cupón
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
                {coupons.length === 0 ? (
                    <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
                            <Gift size={48} />
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Aún no creaste cupones de descuento</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Usalos en Instagram o redes sociales para atraer clientes nuevos.</p>
                    </div>
                ) : (
                    coupons.map(c => {
                        const isPerc = c.discount_type === 'percentage'
                        return (
                            <div key={c.id} className="card card-compact" style={{ position: 'relative', opacity: c.active ? 1 : 0.6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                    <div style={{
                                        background: isPerc ? 'var(--accent-light)' : '#E0E7FF',
                                        color: isPerc ? 'var(--accent)' : '#4F46E5',
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-lg)',
                                        fontSize: 'var(--font-size-lg)',
                                        fontWeight: 800,
                                        letterSpacing: '1px'
                                    }}>
                                        {c.code}
                                    </div>
                                    <button onClick={() => toggleActive(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.active ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                        {c.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>DESCUENTO</div>
                                        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {isPerc ? `${c.discount_value}%` : `$${c.discount_value.toLocaleString()}`}
                                        </div>
                                    </div>
                                    <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>USOS</div>
                                        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                                            {c.uses_count} <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>/ {c.max_uses || '∞'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c.id)}>
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Crear Cupón de Descuento</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div className="error-message" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}
                                
                                <div className="form-group">
                                    <label className="label">Código del cupón *</label>
                                    <input className="input" placeholder="Ej: VERANO20" value={form.code}
                                        style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}
                                        onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} required />
                                </div>

                                <div className="form-group">
                                    <label className="label">Tipo de descuento</label>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                        <button type="button" className={`btn ${form.discount_type === 'percentage' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}
                                            onClick={() => setForm(p => ({ ...p, discount_type: 'percentage' }))}>
                                            <Percent size={14} /> Porcentaje
                                        </button>
                                        <button type="button" className={`btn ${form.discount_type === 'fixed' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }}
                                            onClick={() => setForm(p => ({ ...p, discount_type: 'fixed' }))}>
                                            <CreditCard size={14} /> Fijo ($)
                                        </button>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="label">Valor *</label>
                                        <input className="input" type="number" placeholder={form.discount_type === 'percentage' ? "20" : "5000"} value={form.discount_value}
                                            onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} required min="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Límite de usos totales</label>
                                        <input className="input" type="number" placeholder="Ej: 50 (opcional)" value={form.max_uses}
                                            onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} min="1" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <div className="loading-spinner" /> : 'Crear cupón'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
