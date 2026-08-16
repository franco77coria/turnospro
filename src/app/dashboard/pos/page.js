'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { loadBusinessServices } from '@/lib/services'
import { useState, useEffect } from 'react'
import { Plus, Minus, Search, ShoppingCart, User, CreditCard, CheckCircle2, Package, Scissors, Trash2 } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS, PAYMENT_METHODS } from '@/lib/data'
import { useToast } from '@/components/Toast'

export default function POSPage() {
    return (
        <PermissionGate permission={PERMISSIONS.VIEW_FINANCE}>
            <POSContent />
        </PermissionGate>
    )
}

function POSContent() {
    const toast = useToast()
    const { business } = useAuth()
    const [products, setProducts] = useState([])
    const [services, setServices] = useState([])
    const [cart, setCart] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [clientName, setClientName] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    
    // Switch between products and services tab
    const [activeTab, setActiveTab] = useState('services')

    useEffect(() => {
        if (business?.id) {
            // Fuente única de servicios: el JSONB `business.services` quedaba
            // congelado con los precios y duraciones del onboarding.
            loadBusinessServices(supabase, business.id, { activeOnly: true }).then(setServices)
            loadProducts()
        }
    }, [business?.id])

    async function loadProducts() {
        try {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('business_id', business.id)
                .eq('active', true)
            setProducts(data || [])
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    const addToCart = (item, type) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === (item.id || item.name) && i.type === type)
            if (existing) {
                // If it's a product, check stock
                if (type === 'product' && existing.qty >= item.stock) {
                    toast.error('Stock insuficiente')
                    return prev
                }
                return prev.map(i => i.id === existing.id ? { ...i, qty: i.qty + 1 } : i)
            }
            return [...prev, { ...item, id: item.id || item.name, type, qty: 1 }]
        })
    }

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.id !== id))
    }

    const updateQty = (id, delta, item) => {
        setCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = i.qty + delta
                if (newQty < 1) return i
                if (i.type === 'product' && newQty > item.stock) {
                    toast.error('Stock insuficiente')
                    return i
                }
                return { ...i, qty: newQty }
            }
            return i
        }))
    }

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)

    const filteredItems = (activeTab === 'services' ? services : products).filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    async function handleCheckout() {
        if (cart.length === 0) return
        setSubmitting(true)
        try {
            const productsInCart = cart.filter(i => i.type === 'product')
            
            // Register grouped transaction based on cart total
            const { data: trx, error: trxErr } = await supabase.from('transactions').insert([{
                business_id: business.id,
                type: 'income',
                concept: `Punto de Venta ${clientName ? '- ' + clientName : ''}`.trim(),
                amount: total,
                category: 'pos',
                payment_method: paymentMethod,
            }]).select('id').single()

            if (trxErr) throw trxErr

            // Update product stock sequentially
            for (const item of productsInCart) {
                const newStock = Math.max(0, item.stock - item.qty)
                await supabase.from('products').update({ stock: newStock }).eq('id', item.id)
            }

            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                setCart([])
                setClientName('')
                loadProducts() // reload stock
            }, 3000)

        } catch (err) {
            console.error('POS Checkout Error:', err)
            toast.error('Error al procesar la venta.')
        }
        setSubmitting(false)
    }

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}><div className="loading-spinner" /></div>
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 'var(--space-6)', height: 'calc(100vh - 100px)', alignItems: 'start' }}>
            {/* Left side: Items */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Punto de Venta</h1>
                    
                    <div className="tabs" style={{ background: 'var(--bg-secondary)', padding: 4, borderRadius: 'var(--radius-lg)' }}>
                        <button className={`btn ${activeTab === 'services' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('services')}>
                            <Scissors size={16} /> Servicios
                        </button>
                        <button className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('products')}>
                            <Package size={16} /> Productos
                        </button>
                    </div>
                </div>

                <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                    <Search size={16} style={{ position: 'absolute', left: 16, top: 16, color: 'var(--text-tertiary)' }} />
                    <input 
                        className="input" 
                        placeholder={`Buscar ${activeTab}...`} 
                        style={{ paddingLeft: 42, height: 48, fontSize: 'var(--font-size-md)' }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)', alignContent: 'start', paddingBottom: 'var(--space-10)' }}>
                    {filteredItems.map((item, idx) => (
                        <div 
                            key={idx} 
                            style={{ 
                                background: 'var(--bg-primary)', 
                                border: '1px solid var(--border)', 
                                borderRadius: 'var(--radius-lg)', 
                                padding: 'var(--space-4)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                userSelect: 'none',
                                opacity: (activeTab === 'product' && item.stock === 0) ? 0.5 : 1
                            }}
                            onClick={() => (activeTab === 'services' || item.stock > 0) && addToCart(item, activeTab.slice(0, -1))}
                            className="hover-card"
                        >
                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>{item.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${item.price?.toLocaleString()}</span>
                                {activeTab === 'products' && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: item.stock > 0 ? 'var(--text-tertiary)' : 'var(--danger)' }}>
                                        {item.stock} en stock
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right side: Cart */}
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
                        <ShoppingCart size={20} /> Carrito de Venta
                    </div>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)' }}>
                    {cart.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-10) 0' }}>
                            <Package size={48} style={{ margin: '0 auto var(--space-2)', opacity: 0.5 }} />
                            <p>El carrito está vacío</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {cart.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-3)' }}>
                                    <div style={{ flex: 1, marginRight: 'var(--space-2)' }}>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{item.name}</div>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                                            ${item.price?.toLocaleString()} {item.type === 'product' ? 'x un' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                                            <button className="btn btn-ghost btn-icon" style={{ height: 28, width: 28 }} onClick={() => updateQty(item.id, -1, item)}><Minus size={12} /></button>
                                            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, width: 24, textAlign: 'center' }}>{item.qty}</span>
                                            <button className="btn btn-ghost btn-icon" style={{ height: 28, width: 28 }} onClick={() => updateQty(item.id, 1, item)}><Plus size={12} /></button>
                                        </div>
                                        <button className="btn btn-ghost btn-icon" style={{ height: 24, width: 24, color: 'var(--danger)' }} onClick={() => removeFromCart(item.id)}><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                        <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
                            <User size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                            <input 
                                className="input" 
                                placeholder="Cliente (Opcional)" 
                                style={{ paddingLeft: 34, height: 40, fontSize: 'var(--font-size-sm)' }}
                                value={clientName}
                                onChange={e => setClientName(e.target.value)}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <CreditCard size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-tertiary)' }} />
                            <select 
                                className="input" 
                                style={{ paddingLeft: 34, height: 40, fontSize: 'var(--font-size-sm)' }}
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                            >
                                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total</span>
                        <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>${total.toLocaleString()}</span>
                    </div>

                    {success ? (
                        <div style={{ background: 'var(--success)', color: 'white', padding: '12px', borderRadius: 'var(--radius-md)', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <CheckCircle2 size={18} /> Pago procesado
                        </div>
                    ) : (
                        <button 
                            className="btn btn-primary" 
                            style={{ width: '100%', height: 48, fontSize: 'var(--font-size-md)' }}
                            disabled={cart.length === 0 || submitting}
                            onClick={handleCheckout}
                        >
                            {submitting ? <div className="loading-spinner" /> : 'Cobrar'}
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .hover-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
            `}</style>
        </div>
    )
}
