'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Package, Search } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'

export default function InventoryPage() {
    return (
        <PermissionGate permission={PERMISSIONS.MANAGE_INVENTORY}>
            <InventoryContent />
        </PermissionGate>
    )
}

function InventoryContent() {
    const { business } = useAuth()
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [form, setForm] = useState({ name: '', price: '', stock: '', description: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const loadProducts = useCallback(async () => {
        if (!business?.id) return
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', business.id)
                .order('name', { ascending: true })

            if (error) throw error
            setProducts(data || [])
        } catch (err) {
            console.error('Error load products:', err)
        }
        setLoading(false)
    }, [business?.id])

    useEffect(() => {
        loadProducts()
    }, [loadProducts])

    async function handleSave(e) {
        e.preventDefault()
        setError('')
        setSaving(true)
        try {
            const newPrice = parseFloat(form.price)
            const newStock = parseInt(form.stock)

            if (isNaN(newPrice) || newPrice < 0) throw new Error('Precio inválido')
            if (isNaN(newStock) || newStock < 0) throw new Error('Stock inválido')

            const payload = {
                business_id: business.id,
                name: form.name.trim(),
                price: newPrice,
                stock: newStock,
                description: form.description?.trim() || null,
            }

            if (editingProduct?.id) {
                const { error: updateErr } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', editingProduct.id)
                    .eq('business_id', business.id)
                if (updateErr) throw updateErr
            } else {
                const { error: insErr } = await supabase
                    .from('products')
                    .insert([payload])
                if (insErr) throw insErr
            }

            await loadProducts()
            setShowModal(false)
            setEditingProduct(null)
            setForm({ name: '', price: '', stock: '', description: '' })
        } catch (err) {
            console.error('Error saving product:', err)
            setError(err.message || 'Error al guardar el producto')
        }
        setSaving(false)
    }

    async function handleDelete(id) {
        if (!confirm('¿Eliminar este producto?')) return
        try {
            await supabase
                .from('products')
                .delete()
                .eq('id', id)
                .eq('business_id', business.id)
            
            setProducts(p => p.filter(x => x.id !== id))
        } catch (err) {
            console.error('Error deleting:', err)
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
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Inventario</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>Cargá tus productos físicos a la venta</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setEditingProduct(null)
                    setForm({ name: '', price: '', stock: '0', description: '' })
                    setError('')
                    setShowModal(true)
                }}>
                    <Plus size={14} /> Nuevo producto
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                {products.length === 0 ? (
                    <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)', color: 'var(--text-tertiary)' }}>
                            <Package size={48} />
                        </div>
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>No hay productos cargados</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Usa tu inventario para registrar las ventas de salón.</p>
                    </div>
                ) : (
                    products.map(p => (
                        <div key={p.id} className="card card-compact" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1 }}>
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{p.name}</h3>
                                    {p.description && (
                                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {p.description}
                                        </p>
                                    )}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--accent)' }}>
                                    ${p.price.toLocaleString()}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.stock > 0 ? 'var(--success)' : 'var(--danger)' }} />
                                    {p.stock} en stock
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => {
                                        setEditingProduct(p)
                                        setForm({ name: p.name, price: p.price.toString(), stock: p.stock.toString(), description: p.description || '' })
                                        setShowModal(true)
                                    }}>Editar</button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(p.id)}>
                                        X
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editingProduct ? 'Editar producto' : 'Nuevo producto'}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {error && <div style={{ padding: 'var(--space-3)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#DC2626', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>{error}</div>}
                                
                                <div className="form-group">
                                    <label className="label">Nombre del producto *</label>
                                    <input className="input" placeholder="Ej: Shampoo Fidelite" value={form.name}
                                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="label">Precio ($) *</label>
                                        <input className="input" type="number" placeholder="4500" value={form.price}
                                            onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required min="0" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Stock actual *</label>
                                        <input className="input" type="number" placeholder="10" value={form.stock}
                                            onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} required min="0" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="label">Descripción</label>
                                    <textarea className="input" rows={2} placeholder="Descripción del producto..." value={form.description}
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
