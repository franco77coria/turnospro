'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import PermissionGate from '@/components/PermissionGate'
import { PERMISSIONS } from '@/lib/data'
import { TrendingUp, Users, CalendarDays, AlertTriangle, DollarSign } from 'lucide-react'

export default function AnalyticsPage() {
    return (
        <PermissionGate permission={PERMISSIONS.VIEW_REPORTS}>
            <AnalyticsContent />
        </PermissionGate>
    )
}

function AnalyticsContent() {
    const { business, loading: authLoading } = useAuth()
    const [period, setPeriod] = useState('month') // week | month | year
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    async function loadStats() {
        setLoading(true)
        const now = new Date()
        let startDate

        if (period === 'week') {
            startDate = new Date(now)
            startDate.setDate(now.getDate() - 7)
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else {
            startDate = new Date(now.getFullYear(), 0, 1)
        }

        const startStr = startDate.toISOString().split('T')[0]
        const endStr = now.toISOString().split('T')[0]

        // Fetch appointments
        const { data: appointments } = await supabase
            .from('appointments')
            .select('status, service_name, date, team_member_id, price')
            .eq('business_id', business.id)
            .gte('date', startStr)
            .lte('date', endStr)

        // Fetch transactions (extend to 6 months for monthly chart)
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        const txnStartDate = startDate < sixMonthsAgo ? startDate : sixMonthsAgo
        const { data: transactions } = await supabase
            .from('transactions')
            .select('type, amount, created_at')
            .eq('business_id', business.id)
            .gte('created_at', txnStartDate.toISOString())

        // Fetch team members
        const { data: team } = await supabase
            .from('team_members')
            .select('id, name')
            .eq('business_id', business.id)
            .eq('active', true)

        const apts = appointments || []
        const txns = transactions || []

        // Calculate stats
        const totalApts = apts.length
        const completed = apts.filter(a => a.status === 'completed').length
        const cancelled = apts.filter(a => a.status === 'cancelled').length
        const noShow = apts.filter(a => a.status === 'no_show').length
        const occupancyRate = totalApts > 0 ? Math.round((completed / totalApts) * 100) : 0
        const noShowRate = totalApts > 0 ? Math.round((noShow / totalApts) * 100) : 0
        const cancelRate = totalApts > 0 ? Math.round((cancelled / totalApts) * 100) : 0

        // Revenue
        const totalIncome = txns.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0)
        const totalExpenses = txns.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0)

        // Top services
        const serviceCount = {}
        apts.forEach(a => {
            if (!serviceCount[a.service_name]) serviceCount[a.service_name] = 0
            serviceCount[a.service_name]++
        })
        const topServices = Object.entries(serviceCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

        // Professional performance
        const proStats = (team || []).map(m => ({
            name: m.name,
            count: apts.filter(a => a.team_member_id === m.id).length,
            completed: apts.filter(a => a.team_member_id === m.id && a.status === 'completed').length,
        })).sort((a, b) => b.count - a.count)

        // Revenue by day (last 7 days)
        const revenueByDay = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]
            const dayLabel = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
            const dayIncome = txns
                .filter(t => t.type === 'income' && t.created_at?.startsWith(dateStr))
                .reduce((sum, t) => sum + (t.amount || 0), 0)
            revenueByDay.push({ label: dayLabel, value: dayIncome })
        }

        // Revenue by service (from completed appointments)
        const serviceRevenue = {}
        apts.filter(a => a.status === 'completed' && a.price).forEach(a => {
            if (!serviceRevenue[a.service_name]) serviceRevenue[a.service_name] = 0
            serviceRevenue[a.service_name] += a.price
        })
        const topServicesByRevenue = Object.entries(serviceRevenue)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

        // Appointments by day of week
        const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
        apts.forEach(a => {
            const d = new Date(a.date + 'T12:00:00')
            dayOfWeekCount[d.getDay()]++
        })
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
        const busiestDay = dayOfWeekCount.map((count, i) => ({ label: dayNames[i], value: count }))

        // Monthly revenue (last 6 months)
        const monthlyRevenue = []
        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const monthStr = d.toISOString().slice(0, 7) // "2026-03"
            const monthLabel = d.toLocaleDateString('es-AR', { month: 'short' })
            const monthIncome = txns
                .filter(t => t.type === 'income' && t.created_at?.startsWith(monthStr))
                .reduce((sum, t) => sum + (t.amount || 0), 0)
            monthlyRevenue.push({ label: monthLabel, value: monthIncome })
        }

        setStats({
            totalApts, completed, cancelled, noShow,
            occupancyRate, noShowRate, cancelRate,
            totalIncome, totalExpenses,
            topServices, proStats, revenueByDay,
            topServicesByRevenue, busiestDay, monthlyRevenue,
        })
        setLoading(false)
    }

    useEffect(() => {
        if (!business?.id || !supabase) return
        loadStats()
    }, [business?.id, period])

    if (authLoading || !business?.id) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}><div className="loading-spinner" /></div>
    }

    const maxRevenue = stats ? Math.max(...stats.revenueByDay.map(d => d.value), 1) : 1

    return (
        <div style={{ maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Estadísticas</h1>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {[
                        { id: 'week', label: 'Semana' },
                        { id: 'month', label: 'Mes' },
                        { id: 'year', label: 'Año' },
                    ].map(p => (
                        <button key={p.id}
                            className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setPeriod(p.id)}
                        >{p.label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}><div className="loading-spinner" /></div>
            ) : stats && (
                <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                        <StatCard icon={CalendarDays} label="Turnos" value={stats.totalApts} color="var(--accent)" />
                        <StatCard icon={TrendingUp} label="Tasa completados" value={`${stats.occupancyRate}%`} color="var(--success)" />
                        <StatCard icon={AlertTriangle} label="No asistieron" value={`${stats.noShowRate}%`} color="var(--warning)" subtitle={`${stats.noShow} turnos`} />
                        <StatCard icon={DollarSign} label="Ingresos" value={`$${stats.totalIncome.toLocaleString()}`} color="var(--success)" />
                    </div>

                    {/* Revenue Chart (CSS bar chart) */}
                    <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Ingresos últimos 7 días</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: 150 }}>
                            {stats.revenueByDay.map((d, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                        {d.value > 0 ? `$${(d.value / 1000).toFixed(1)}k` : ''}
                                    </span>
                                    <div style={{
                                        width: '100%', maxWidth: 40,
                                        height: `${Math.max((d.value / maxRevenue) * 120, 4)}px`,
                                        background: d.value > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        transition: 'height 0.3s ease',
                                    }} />
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{d.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Monthly Revenue (6 months) */}
                    {stats.monthlyRevenue && (
                        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Ingresos mensuales</h3>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)', height: 150 }}>
                                {stats.monthlyRevenue.map((d, i) => {
                                    const maxVal = Math.max(...stats.monthlyRevenue.map(m => m.value), 1)
                                    return (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                                                {d.value > 0 ? `$${(d.value / 1000).toFixed(0)}k` : ''}
                                            </span>
                                            <div style={{
                                                width: '100%', maxWidth: 48,
                                                height: `${Math.max((d.value / maxVal) * 120, 4)}px`,
                                                background: d.value > 0 ? 'var(--success)' : 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)',
                                                transition: 'height 0.3s ease',
                                            }} />
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{d.label}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                        {/* Busiest Day of Week */}
                        {stats.busiestDay && (
                            <div className="card">
                                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Dia mas activo</h3>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)', height: 100 }}>
                                    {stats.busiestDay.map((d, i) => {
                                        const maxVal = Math.max(...stats.busiestDay.map(m => m.value), 1)
                                        const isMax = d.value === maxVal && d.value > 0
                                        return (
                                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.value || ''}</span>
                                                <div style={{
                                                    width: '100%', maxWidth: 32,
                                                    height: `${Math.max((d.value / maxVal) * 70, 3)}px`,
                                                    background: isMax ? 'var(--accent)' : 'var(--accent-subtle)',
                                                    borderRadius: 'var(--radius-sm)',
                                                }} />
                                                <span style={{ fontSize: 10, color: isMax ? 'var(--accent)' : 'var(--text-tertiary)', fontWeight: isMax ? 600 : 400 }}>{d.label}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Revenue by Service */}
                        {stats.topServicesByRevenue?.length > 0 && (
                            <div className="card">
                                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Ingresos por servicio</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {stats.topServicesByRevenue.map(([name, revenue]) => {
                                        const maxRev = stats.topServicesByRevenue[0]?.[1] || 1
                                        return (
                                            <div key={name}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
                                                    <span>{name}</span>
                                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>${revenue.toLocaleString()}</span>
                                                </div>
                                                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                                                    <div style={{ height: '100%', width: `${(revenue / maxRev) * 100}%`, background: 'var(--success)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)' }}>
                        {/* Top Services */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Servicios más solicitados</h3>
                            {stats.topServices.length === 0 ? (
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Sin datos en este período</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {stats.topServices.map(([name, count], i) => {
                                        const maxCount = stats.topServices[0]?.[1] || 1
                                        return (
                                            <div key={name}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
                                                    <span>{name}</span>
                                                    <span style={{ color: 'var(--text-tertiary)' }}>{count} turnos</span>
                                                </div>
                                                <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3 }}>
                                                    <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: 'var(--accent)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Professional Performance */}
                        <div className="card">
                            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Rendimiento por profesional</h3>
                            {stats.proStats.length === 0 ? (
                                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Sin equipo configurado</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {stats.proStats.map(pro => (
                                        <div key={pro.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-sm)', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 600, flexShrink: 0 }}>
                                                    {pro.name[0]}
                                                </div>
                                                <span>{pro.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 'var(--space-3)', color: 'var(--text-tertiary)' }}>
                                                <span>{pro.count} turnos</span>
                                                <span style={{ color: 'var(--success)' }}>{pro.completed} ok</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary footer */}
                    <div className="card" style={{ marginTop: 'var(--space-5)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Completados</span>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>{stats.completed}</div>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Cancelados</span>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)', color: 'var(--danger)' }}>{stats.cancelled} ({stats.cancelRate}%)</div>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Gastos</span>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>${stats.totalExpenses.toLocaleString()}</div>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Balance</span>
                                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)', color: (stats.totalIncome - stats.totalExpenses) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                    ${(stats.totalIncome - stats.totalExpenses).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StatCard({ icon: Icon, label, value, color, subtitle }) {
    return (
        <div className="card card-compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
            </div>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
            {subtitle && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{subtitle}</span>}
        </div>
    )
}
