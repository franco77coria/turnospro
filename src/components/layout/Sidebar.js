'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { BarChart3, CalendarDays, Clock, Users, Tag, UserCircle, Wallet, Settings, LogOut } from 'lucide-react'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/dashboard/calendar', label: 'Calendario', icon: CalendarDays },
    { href: '/dashboard/appointments', label: 'Turnos', icon: Clock },
    { href: '/dashboard/clients', label: 'Clientes', icon: Users },
    { href: '/dashboard/services', label: 'Servicios', icon: Tag },
    { href: '/dashboard/team', label: 'Equipo', icon: UserCircle },
    { href: '/dashboard/finance', label: 'Caja', icon: Wallet },
]

const BOTTOM_ITEMS = [
    { href: '/dashboard/settings', label: 'Configuración', icon: Settings },
]

export default function Sidebar() {
    const pathname = usePathname()
    const { profile, business, signOut } = useAuth()

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(href)
    }

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>T</div>
                <div className={styles.logoText}>
                    <span className={styles.logoName}>{business?.name || 'TurnosPro'}</span>
                    <span className={styles.logoRole}>{profile?.role || 'Admin'}</span>
                </div>
            </div>

            <nav className={styles.nav}>
                <div className={styles.navGroup}>
                    {NAV_ITEMS.map(item => {
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
                            >
                                <Icon size={18} className={styles.navIcon} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>

            <div className={styles.bottom}>
                {BOTTOM_ITEMS.map(item => {
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
                        >
                            <Icon size={18} className={styles.navIcon} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
                <div className={styles.userCard}>
                    <div className="avatar avatar-sm">
                        {profile?.full_name?.[0] || 'U'}
                    </div>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{profile?.full_name || 'Usuario'}</span>
                        <span className={styles.userEmail}>{profile?.email || ''}</span>
                    </div>
                    <button onClick={signOut} className={styles.logoutBtn} title="Cerrar sesión">
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
