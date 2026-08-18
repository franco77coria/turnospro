'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import { PAYMENT_METHODS, EXPENSE_CATEGORIES } from '@/lib/data'
import { TrendingUp, TrendingDown, DollarSign, Banknote, ClipboardList, Plus, X, Download } from 'lucide-react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'
import { useToast } from '@/components/Toast'
import styles from './finance.module.css'

export default function FinancePage() {
    return (
        <PermissionGate permission={PERMISSIONS.VIEW_FINANCE}>
            <FinanceContent />
        </PermissionGate>
    )
}

function FinanceContent() {
    const toast = useToast()
    const { business, loading: authLoading } = useAuth()
    const [transactions, setTransactions] = useState([])
    const [filter, setFilter] = useState('all')
    const [showExpenseModal, setShowExpenseModal] = useState(false)
    const [showClosureModal, setShowClosureModal] = useState(false)
    const [expenseForm, setExpenseForm] = useState({ concept: '', amount: '', category: 'products', payment_method: 'cash' })
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [selectedDate, setSelectedDate] = useState(localToday)

    // Se extrae el id: la dependencia declarada tiene que coincidir
    // exactamente con lo que el cuerpo lee.
    const businessId = business?.id

    const loadTransactions = useCallback(async () => {
        if (!supabase) return
        const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('business_id', businessId)
            .gte('created_at', `${selectedDate}T00:00:00`)
            .lte('created_at', `${selectedDate}T23:59:59`)
            .order('created_at', { ascending: false })
        setTransactions(data || [])
    }, [businessId, selectedDate])

    useEffect(() => {
        if (business?.id) loadTransactions()
    }, [business?.id, selectedDate, loadTransactions])

    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const balance = income - expenses
    const cash = transactions.filter(t => t.payment_method === 'cash' && t.type === 'income').reduce((s, t) => s + t.amount, 0)

    const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter)

    async function handleAddExpense(e) {
        e.preventDefault()
        if (!supabase) return
        try {
            await supabase.from('transactions').insert([{
                business_id: business.id,
                type: 'expense',
                concept: expenseForm.concept,
                amount: parseFloat(expenseForm.amount),
                category: expenseForm.category,
                payment_method: expenseForm.payment_method,
            }])
            setShowExpenseModal(false)
            setExpenseForm({ concept: '', amount: '', category: 'products', payment_method: 'cash' })
            loadTransactions()
        } catch (err) {
            console.error('Error adding expense:', err)
        }
    }

    async function handleCloseCash() {
        if (!supabase) return
        try {
            const { error } = await supabase.from('cash_closures').insert([{
                business_id: business.id,
                date: selectedDate,
                total_income: income,
                total_expenses: expenses,
                balance,
                cash_amount: cash,
                transaction_count: transactions.length,
            }])
            if (error) {
                console.error('Cash closure error:', error)
                toast.error('Error al registrar cierre: ' + (error.message || 'tabla no encontrada'))
                return
            }
            setShowClosureModal(false)
            toast.success('Cierre de caja registrado correctamente')
        } catch (err) {
            console.error('Error closing cash:', err)
            toast.error('Error al registrar el cierre de caja')
        }
    }

    function handleExportCSV() {
        if (transactions.length === 0) return toast.info('No hay movimientos para exportar.')
        
        const headers = ['Fecha', 'Hora', 'Tipo', 'Monto', 'Concepto_Categoria', 'Metodo_de_Pago']
        const rows = transactions.map(t => [
            new Date(t.created_at).toLocaleDateString('es-AR'),
            new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            t.type === 'income' ? 'Ingreso' : 'Gasto',
            t.amount,
            t.concept || t.category || '',
            PAYMENT_METHODS.find(p => p.id === t.payment_method)?.name || t.payment_method
        ])
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `caja_${selectedDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const paymentBreakdown = PAYMENT_METHODS.map(pm => ({
        ...pm,
        total: transactions.filter(t => t.payment_method === pm.id && t.type === 'income').reduce((s, t) => s + t.amount, 0)
    })).filter(pm => pm.total > 0)

    if (authLoading || !business?.id) {
        return (
            <div className={styles.finance}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    return (
        <div className={styles.finance}>
            <div className={styles.header}>
                <div>
                    <h1>Caja y Finanzas</h1>
                    <input type="date" className={styles.dateInput} value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div className={styles.headerActions}>
                    <button className="btn btn-ghost" onClick={handleExportCSV} title="Exportar a CSV">
                        <Download size={16} /> Exportar
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowClosureModal(true)}>
                        <ClipboardList size={16} /> Cierre de caja
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowExpenseModal(true)}>
                        <Plus size={16} /> Registrar gasto
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Ingresos</span>
                        <span className="stat-value" style={{ color: 'var(--success)' }}>${income.toLocaleString()}</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Gastos</span>
                        <span className="stat-value" style={{ color: 'var(--danger)' }}>${expenses.toLocaleString()}</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Balance</span>
                        <span className="stat-value">${balance.toLocaleString()}</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Efectivo en caja</span>
                        <span className="stat-value">${cash.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Payment breakdown */}
            {paymentBreakdown.length > 0 && (
                <div className={`card ${styles.breakdownCard}`}>
                    <h3>Medios de pago</h3>
                    <div className={styles.breakdownList}>
                        {paymentBreakdown.map(pm => (
                            <div key={pm.id} className={styles.breakdownItem}>
                                <span>{pm.name}</span>
                                <span className={styles.breakdownAmount}>${pm.total.toLocaleString()}</span>
                                <div className={styles.breakdownBar}>
                                    <div style={{ width: `${income > 0 ? (pm.total / income) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transactions */}
            <div className="card" style={{ padding: 0 }}>
                <div className={styles.tableHeader}>
                    <div className="tabs">
                        {[
                            { id: 'all', label: 'Todos' },
                            { id: 'income', label: 'Ingresos' },
                            { id: 'expense', label: 'Gastos' },
                        ].map(tab => (
                            <button key={tab.id} className={`tab ${filter === tab.id ? 'active' : ''}`}
                                onClick={() => setFilter(tab.id)}>{tab.label}</button>
                        ))}
                    </div>
                </div>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th className="hide-mobile">Método</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>No hay movimientos</td></tr>
                            ) : filtered.map(t => (
                                <tr key={t.id}>
                                    <td>{new Date(t.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td>{t.concept || t.category}</td>
                                    <td style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                        {t.type === 'income' ? '+' : '-'}${t.amount?.toLocaleString()}
                                    </td>
                                    <td className="hide-mobile">{PAYMENT_METHODS.find(p => p.id === t.payment_method)?.name || t.payment_method}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Expense Modal */}
            {showExpenseModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowExpenseModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Registrar gasto</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleAddExpense}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="label">Concepto *</label>
                                    <input className="input" placeholder="Ej: Productos de limpieza" value={expenseForm.concept}
                                        onChange={e => setExpenseForm(p => ({ ...p, concept: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Monto *</label>
                                    <input className="input" type="number" placeholder="0" value={expenseForm.amount}
                                        onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="label">Categoría</label>
                                    <select className="input select" value={expenseForm.category}
                                        onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))}>
                                        {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Método de pago</label>
                                    <select className="input select" value={expenseForm.payment_method}
                                        onChange={e => setExpenseForm(p => ({ ...p, payment_method: e.target.value }))}>
                                        {PAYMENT_METHODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary">Registrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cash Closure Modal */}
            {showClosureModal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowClosureModal(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Cierre de caja — {selectedDate}</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowClosureModal(false)}><X size={16} /></button>
                        </div>
                        <div className="modal-body">
                            <div className={styles.closureSummary}>
                                <div className={styles.closureRow}><span>Ingresos</span><span style={{ color: 'var(--success)' }}>+${income.toLocaleString()}</span></div>
                                <div className={styles.closureRow}><span>Gastos</span><span style={{ color: 'var(--danger)' }}>-${expenses.toLocaleString()}</span></div>
                                <div className={`${styles.closureRow} ${styles.closureTotal}`}><span>Balance</span><span>${balance.toLocaleString()}</span></div>
                                <div className={styles.closureRow}><span>Efectivo en caja</span><span>${cash.toLocaleString()}</span></div>
                                <div className={styles.closureRow}><span>Movimientos</span><span>{transactions.length}</span></div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowClosureModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleCloseCash}>Confirmar cierre</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
