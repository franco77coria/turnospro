'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { CalendarDays, Users, DollarSign, CheckCircle, Clock, UserPlus, Receipt, UsersRound, Tag, Settings, ArrowRight } from 'lucide-react'
import styles from './dashboard.module.css'

export default function DashboardPage() {
    const { profile, business } = useAuth()
    const [stats, setStats] = useState({ todayAppointments: 0, newClients: 0, revenue: 0, attendance: 0 })
    const [upcomingAppointments, setUpcomingAppointments] = useState([])

    const today = new Date().toISOString().split('T')[0]
    const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'

    useEffect(() => {
        if (!business?.id) return
        loadDashboardData()
    }, [business?.id])

    async function loadDashboardData() {
        if (!supabase) return
        try {
            const { data: appointments } = await supabase
                .from('appointments')
                .select('*, clients(name, phone), team_members(name)')
                .eq('business_id', business.id)
                .gte('date', today)
                .lte('date', today)
                .order('time', { ascending: true })

            const completed = appointments?.filter(a => a.status === 'completed').length || 0
            const total = appointments?.length || 0

            const { data: transactions } = await supabase
                .from('transactions')
                .select('*')
                .eq('business_id', business.id)
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`)

            const revenue = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0

            const { data: upcoming } = await supabase
                .from('appointments')
                .select('*, clients(name, phone), team_members(name)')
                .eq('business_id', business.id)
                .gte('date', today)
                .in('status', ['pending', 'confirmed'])
                .order('date', { ascending: true })
                .order('time', { ascending: true })
                .limit(5)

            setStats({
                todayAppointments: total,
                newClients: 0,
                revenue,
                attendance: total > 0 ? Math.round((completed / total) * 100) : 0,
            })
            setUpcomingAppointments(upcoming || [])
        } catch (err) {
            console.error('Dashboard data error:', err)
        }
    }

    const statusBadge = (status) => {
        const s = Object.values(APPOINTMENT_STATUS).find(a => a.id === status)
        return s ? <span className={`badge badge-${s.color}`}>{s.label}</span> : null
    }

    return (
        <div className={styles.dashboard}>
            <div className={styles.header}>
                <div>
                    <h1>{greeting}, {profile?.full_name?.split(' ')[0] || 'Admin'}</h1>
                    <p className={styles.subtitle}>Resumen de tu negocio para hoy</p>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Turnos hoy</span>
                        <span className="stat-value">{stats.todayAppointments}</span>
                        <span className="stat-change positive"><CalendarDays size={12} /> Programados</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Clientes nuevos</span>
                        <span className="stat-value">{stats.newClients}</span>
                        <span className="stat-change positive"><Users size={12} /> Este mes</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Ingresos</span>
                        <span className="stat-value">${stats.revenue.toLocaleString()}</span>
                        <span className="stat-change positive"><DollarSign size={12} /> Hoy</span>
                    </div>
                </div>
                <div className="card card-compact">
                    <div className="stat-card">
                        <span className="stat-label">Asistencia</span>
                        <span className="stat-value">{stats.attendance}%</span>
                        <span className="stat-change positive"><CheckCircle size={12} /> Completados</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className={styles.contentGrid}>
                <div className="card">
                    <div className={styles.cardHeader}>
                        <h3>Próximos turnos</h3>
                        <a href="/dashboard/appointments" className={styles.viewAll}>Ver todos</a>
                    </div>

                    {upcomingAppointments.length === 0 ? (
                        <div className={styles.emptyMsg}>
                            <p>No hay turnos próximos</p>
                            <a href="/dashboard/calendar" className="btn btn-primary btn-sm">+ Nuevo turno</a>
                        </div>
                    ) : (
                        <div className={styles.appointmentList}>
                            {upcomingAppointments.map(apt => (
                                <div key={apt.id} className={styles.appointmentItem}>
                                    <div className={styles.aptTime}>
                                        <span className={styles.aptTimeValue}>{apt.time?.slice(0, 5)}</span>
                                        <span className={styles.aptDate}>{apt.date === today ? 'Hoy' : apt.date}</span>
                                    </div>
                                    <div className={styles.aptInfo}>
                                        <span className={styles.aptClient}>{apt.clients?.name || 'Cliente'}</span>
                                        <span className={styles.aptService}>{apt.service_name}</span>
                                    </div>
                                    <div>{statusBadge(apt.status)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className={styles.cardHeader}>
                        <h3>Acciones rápidas</h3>
                    </div>
                    <div className={styles.quickActions}>
                        <a href="/dashboard/calendar" className={styles.quickAction}>
                            <CalendarDays size={16} /> Nuevo turno
                        </a>
                        <a href="/dashboard/clients" className={styles.quickAction}>
                            <UserPlus size={16} /> Agregar cliente
                        </a>
                        <a href="/dashboard/finance" className={styles.quickAction}>
                            <Receipt size={16} /> Registrar gasto
                        </a>
                        <a href="/dashboard/team" className={styles.quickAction}>
                            <UsersRound size={16} /> Ver equipo
                        </a>
                        <a href="/dashboard/services" className={styles.quickAction}>
                            <Tag size={16} /> Editar servicios
                        </a>
                        <a href="/dashboard/settings" className={styles.quickAction}>
                            <Settings size={16} /> Configuración
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
