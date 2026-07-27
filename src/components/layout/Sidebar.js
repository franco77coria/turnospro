'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { isSuperAdmin } from '@/lib/superadmin'
import { filterNavByRole } from '@/lib/permissions'
import { Icons } from '@/components/Icons'
import DarkModeToggle from '@/components/DarkModeToggle'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Hoy', icon: 'Sparkles' },
  { href: '/dashboard/calendar', label: 'Agenda', icon: 'Calendar' },
  { href: '/dashboard/appointments', label: 'Turnos', icon: 'Clock' },
  { href: '/dashboard/clients', label: 'Clientes', icon: 'Users' },
  { href: '/dashboard/services', label: 'Servicios', icon: 'Scissors' },
  { href: '/dashboard/finance', label: 'Caja', icon: 'Wallet' },
  { href: '/dashboard/team', label: 'Equipo', icon: 'User' },
  { href: '/dashboard/analytics', label: 'Estadísticas', icon: 'BarChart' },
]

const CLIENT_NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: 'Sparkles' },
  { href: '/dashboard/appointments', label: 'Mis Turnos', icon: 'Calendar' },
  { href: '/explore', label: 'Buscar', icon: 'Search' },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/subscription', label: 'Suscripción', icon: 'CreditCard' },
  { href: '/dashboard/settings', label: 'Configuración', icon: 'Palette' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, profile, business, signOut } = useAuth()

  const isClient = profile?.role === 'user' && !profile?.business_id

  const isActive = (href) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const showAdmin = user && isSuperAdmin(user.email)
  const userRole = profile?.role || 'Profesional'
  const visibleNavItems = isClient ? CLIENT_NAV_ITEMS : filterNavByRole(NAV_ITEMS, userRole)
  const visibleBottomItems = isClient ? [] : filterNavByRole(BOTTOM_ITEMS, userRole)

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (e) {
      console.error('Logout error:', e)
    }
    window.location.href = '/login'
  }

  return (
    <aside className="dash-sidebar">
      {/* Brand Header */}
      <div className="dash-brand">
        <img src="/logo.png" alt="G" className="gu-logo-mark" />
        <span>GLOWUP</span>
      </div>

      {/* Business / User Info Card */}
      <div className="dash-biz">
        <div className="dash-biz-thumb">
          {isClient
            ? (profile?.full_name?.[0]?.toUpperCase() || 'U')
            : (business?.name?.[0]?.toUpperCase() || 'G')
          }
        </div>
        <div>
          <div className="dash-biz-name">{isClient ? (profile?.full_name || 'Mi Cuenta') : (business?.name || 'Mi Negocio')}</div>
          <div className="dash-biz-role">{isClient ? 'Cliente' : (profile?.role || 'Administrador')}</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {visibleNavItems.map(item => {
          const IconComponent = Icons[item.icon] || Icons.Sparkles
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              <IconComponent size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {showAdmin && (
          <>
            <div className="dash-nav-sep" />
            <Link
              href="/dashboard/admin"
              className={`dash-nav-item ${isActive('/dashboard/admin') ? 'active' : ''}`}
            >
              <Icons.Shield size={20} />
              <span>Aprobaciones</span>
            </Link>
            <Link
              href="/dashboard/demo"
              className={`dash-nav-item ${isActive('/dashboard/demo') ? 'active' : ''}`}
            >
              <Icons.Eye size={20} />
              <span>Demo Rubros</span>
            </Link>
            {business?.id && (
              <a
                href={`/book/${business.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-nav-item"
              >
                <Icons.ArrowRight size={20} />
                <span>Vista cliente</span>
              </a>
            )}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
        {visibleBottomItems.map(item => {
          const IconComponent = Icons[item.icon] || Icons.Palette
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              <IconComponent size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="dash-nav-sep" />

        {/* User Card & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
          <div 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, var(--pink), var(--violet))', 
              display: 'grid', 
              placeItems: 'center',
              color: 'white',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Usuario'}
            </div>
            <div style={{ fontSize: '11px', color: 'color-mix(in oklab, var(--cream) 50%, transparent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.email || 'email@glowup.com'}
            </div>
          </div>
          
          <DarkModeToggle />

          <button 
            onClick={handleSignOut}
            style={{ 
              color: 'color-mix(in oklab, var(--cream) 60%, transparent)', 
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: '6px',
              borderRadius: '50%',
              transition: 'all var(--t-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--pink)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'color-mix(in oklab, var(--cream) 60%, transparent)'}
            title="Cerrar sesión"
            type="button"
          >
            <Icons.LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
