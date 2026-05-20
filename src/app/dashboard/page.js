'use client'

import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { APPOINTMENT_STATUS } from '@/lib/data'
import { Icons } from '@/components/Icons'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'

export default function DashboardPage() {
  const { profile, business, loading: authLoading } = useAuth()
  const [stats, setStats] = useState({ todayAppointments: 0, newClients: 0, revenue: 0, attendance: 0 })
  const [todayAppointmentsList, setTodayAppointmentsList] = useState([])
  const [today, setToday] = useState('')
  const [formattedDate, setFormattedDate] = useState('')
  const [greeting, setGreeting] = useState('')

  async function loadDashboardData() {
    if (!supabase || !business?.id) return
    try {
      // Get all today's appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, clients(name, phone), team_members(name)')
        .eq('business_id', business.id)
        .eq('date', today)
        .order('time', { ascending: true })

      const completed = appointments?.filter(a => a.status === 'completed').length || 0
      const total = appointments?.length || 0

      // Calculate revenue
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('business_id', business.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)

      const revenue = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0

      // New clients this month
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStartStr = monthStart.toISOString().split('T')[0]
      const { count: newClientsCount } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .gte('created_at', `${monthStartStr}T00:00:00`)

      setStats({
        todayAppointments: total,
        newClients: newClientsCount || 0,
        revenue,
        attendance: total > 0 ? Math.round((completed / total) * 100) : 0,
      })

      setTodayAppointmentsList(appointments || [])
    } catch (err) {
      console.error('Dashboard load data error:', err)
    }
  }

  useEffect(() => {
    if (!business?.id || !today) return
    loadDashboardData()
  }, [business?.id, today])

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    setToday(`${year}-${month}-${day}`)
    
    // Format date in Spanish: e.g. "Martes 19 de mayo"
    const options = { weekday: 'long', day: 'numeric', month: 'long' }
    setFormattedDate(new Intl.DateTimeFormat('es-AR', options).format(now))

    const h = now.getHours()
    setGreeting(h < 12 ? 'Hola' : h < 18 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

  const getStatusClass = (status) => {
    if (status === 'completed') return 'confirmed' // mint style
    if (status === 'confirmed') return 'now' // ink style
    if (status === 'pending') return 'pending' // yellow style
    return ''
  }

  const getBarColor = (svc) => {
    const hash = svc.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = ['pink', 'violet', 'yellow', 'mint', 'ink']
    return colors[hash % colors.length]
  }

  if (authLoading || !business?.id) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--line)', borderTopColor: 'var(--pink)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div>
      {/* TOPBAR */}
      <div className="dash-topbar">
        <div>
          <h1 className="dash-greeting">
            {greeting} {profile?.full_name?.split(' ')[0] || 'Admin'}, <em>vamos.</em>
          </h1>
          <div className="dash-date">{formattedDate}</div>
        </div>
        <div className="dash-actions">
          <NotificationBell />
          <Link href="/dashboard/calendar" className="gu-btn gu-btn-pink">
            <Icons.Plus size={16}/> Nuevo turno
          </Link>
        </div>
      </div>

      {/* KPIS ROW */}
      <div className="dash-kpis">
        {/* Turnos hoy */}
        <div className="dash-kpi">
          <div className="dash-kpi-label">
            <span style={{ 
              background: 'var(--pink-tint)', 
              color: 'var(--pink-deep)', 
              width: '28px', 
              height: '28px', 
              borderRadius: '10px', 
              display: 'grid', 
              placeItems: 'center' 
            }}>
              <Icons.Calendar size={16} />
            </span>
            Turnos hoy
          </div>
          <div className="dash-kpi-value">{stats.todayAppointments}</div>
          <div className="dash-kpi-trend up">
            <Icons.Check size={10} stroke={3} />
            Programados
          </div>
        </div>

        {/* Facturado */}
        <div className="dash-kpi">
          <div className="dash-kpi-label">
            <span style={{ 
              background: 'var(--violet-tint)', 
              color: 'var(--violet-deep)', 
              width: '28px', 
              height: '28px', 
              borderRadius: '10px', 
              display: 'grid', 
              placeItems: 'center' 
            }}>
              <Icons.Wallet size={16} />
            </span>
            Ingresos hoy
          </div>
          <div className="dash-kpi-value">${stats.revenue.toLocaleString()}</div>
          <div className="dash-kpi-trend up">
            <Icons.Check size={10} stroke={3} />
            Registrado
          </div>
        </div>

        {/* Clientes nuevos */}
        <div className="dash-kpi">
          <div className="dash-kpi-label">
            <span style={{ 
              background: 'var(--mint-soft)', 
              color: '#008C66', 
              width: '28px', 
              height: '28px', 
              borderRadius: '10px', 
              display: 'grid', 
              placeItems: 'center' 
            }}>
              <Icons.Users size={16} />
            </span>
            Clientes nuevos
          </div>
          <div className="dash-kpi-value">{stats.newClients}</div>
          <div className="dash-kpi-trend up">
            <Icons.Check size={10} stroke={3} />
            Este mes
          </div>
        </div>

        {/* Asistencia */}
        <div className="dash-kpi">
          <div className="dash-kpi-label">
            <span style={{ 
              background: 'var(--yellow-soft)', 
              color: '#B47E00', 
              width: '28px', 
              height: '28px', 
              borderRadius: '10px', 
              display: 'grid', 
              placeItems: 'center' 
            }}>
              <Icons.Clock size={16} />
            </span>
            Asistencia
          </div>
          <div className="dash-kpi-value">{stats.attendance}%</div>
          <div className="dash-kpi-trend up">
            <Icons.Check size={10} stroke={3} />
            Completados
          </div>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="dash-grid-2">
        
        {/* AGENDA DEL DIA */}
        <div className="dash-card">
          <div className="dash-card-head">
            <div>
              <div className="dash-card-title">Agenda de hoy</div>
              <div className="dash-card-sub">{stats.todayAppointments} turnos programados</div>
            </div>
            <Link href="/dashboard/calendar" className="gu-btn gu-btn-ghost gu-btn-sm">
              Ver calendario <Icons.ArrowRight size={14}/>
            </Link>
          </div>

          <div className="dash-schedule">
            {todayAppointmentsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--ink-mute)' }}>
                <Icons.Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ fontWeight: 600 }}>No hay turnos para hoy</p>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>Hacé click en &quot;Nuevo turno&quot; para agendar uno.</p>
              </div>
            ) : (
              todayAppointmentsList.map((appt) => (
                <div key={appt.id} className="dash-schedule-item">
                  <div className="dash-schedule-time">
                    {appt.time?.slice(0, 5)}
                    <small>{appt.duration} min</small>
                  </div>
                  <span className={`dash-schedule-bar ${getBarColor(appt.service_name)}`}></span>
                  <div className="dash-schedule-info">
                    <b>{appt.clients?.name || 'Cliente'}</b>
                    <small>{appt.service_name} · {appt.team_members?.name || 'Cualquiera'}</small>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
                      ${appt.price?.toLocaleString() || '0'}
                    </span>
                    <span className={`dash-schedule-status ${getStatusClass(appt.status)}`}>
                      {appt.status === 'completed' ? 'Listo' : appt.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ACCIONES RAPIDAS & ESTADISTICA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Mini chart semanal */}
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <div className="dash-card-title">Resumen semanal</div>
                <div className="dash-card-sub">Progreso diario</div>
              </div>
            </div>
            
            {/* Chart mock super estético */}
            <div className="dash-chart">
              <div className="dash-chart-bar" style={{ height: '60%' }}></div>
              <div className="dash-chart-bar" style={{ height: '85%' }}></div>
              <div className="dash-chart-bar" style={{ height: '40%' }}></div>
              <div className="dash-chart-bar dim" style={{ height: '10%' }}></div>
              <div className="dash-chart-bar dim" style={{ height: '10%' }}></div>
              <div className="dash-chart-bar dim" style={{ height: '10%' }}></div>
              <div className="dash-chart-bar dim" style={{ height: '10%' }}></div>
            </div>
            <div className="dash-chart-x">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mie</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sab</span>
              <span>Dom</span>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="dash-card">
            <div className="dash-card-head">
              <div className="dash-card-title">Acciones rápidas</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Link href="/dashboard/calendar" className="gu-btn gu-btn-ghost gu-btn-block" style={{ height: '52px', fontSize: '14px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start' }}>
                <Icons.Calendar size={16} /> Agenda
              </Link>
              <Link href="/dashboard/clients" className="gu-btn gu-btn-ghost gu-btn-block" style={{ height: '52px', fontSize: '14px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start' }}>
                <Icons.Users size={16} /> Clientes
              </Link>
              <Link href="/dashboard/services" className="gu-btn gu-btn-ghost gu-btn-block" style={{ height: '52px', fontSize: '14px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start' }}>
                <Icons.Scissors size={16} /> Servicios
              </Link>
              <Link href="/dashboard/finance" className="gu-btn gu-btn-ghost gu-btn-block" style={{ height: '52px', fontSize: '14px', borderRadius: 'var(--r-md)', justifyContent: 'flex-start' }}>
                <Icons.Wallet size={16} /> Caja
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
