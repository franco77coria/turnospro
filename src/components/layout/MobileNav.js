'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { BarChart3, CalendarDays, Clock, Wallet, Menu, X, Users, Tag, UserCircle, Settings, LogOut } from 'lucide-react'
import styles from './MobileNav.module.css'

const MAIN_ITEMS = [
    { href: '/dashboard', label: 'Inicio', icon: BarChart3 },
    { href: '/dashboard/calendar', label: 'Agenda', icon: CalendarDays },
    { href: '/dashboard/appointments', label: 'Turnos', icon: Clock },
    { href: '/dashboard/finance', label: 'Caja', icon: Wallet },
]

const MORE_ITEMS = [
    { href: '/dashboard/clients', label: 'Clientes', icon: Users },
    { href: '/dashboard/services', label: 'Servicios', icon: Tag },
    { href: '/dashboard/team', label: 'Equipo', icon: UserCircle },
    { href: '/dashboard/settings', label: 'Configuracion', icon: Settings },
]

export default function MobileNav() {
    const pathname = usePathname()
    const { signOut } = useAuth()
    const [showMore, setShowMore] = useState(false)

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(href)
    }

    const moreActive = MORE_ITEMS.some(item => isActive(item.href))

    return (
        <>
            {showMore && (
                <div className={styles.moreOverlay} onClick={() => setShowMore(false)}>
                    <div className={styles.moreMenu} onClick={e => e.stopPropagation()}>
                        <div className={styles.moreHeader}>
                            <span>Mas opciones</span>
                            <button className={styles.moreClose} onClick={() => setShowMore(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        {MORE_ITEMS.map(item => {
                            const Icon = item.icon
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.moreItem} ${isActive(item.href) ? styles.moreItemActive : ''}`}
                                    onClick={() => setShowMore(false)}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                        <button className={`${styles.moreItem} ${styles.logoutItem}`} onClick={signOut}>
                            <LogOut size={18} />
                            <span>Cerrar sesion</span>
                        </button>
                    </div>
                </div>
            )}
            <nav className={styles.mobileNav}>
                {MAIN_ITEMS.map(item => {
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.item} ${isActive(item.href) ? styles.active : ''}`}
                        >
                            <Icon size={20} />
                            <span className={styles.label}>{item.label}</span>
                        </Link>
                    )
                })}
                <button
                    className={`${styles.item} ${moreActive || showMore ? styles.active : ''}`}
                    onClick={() => setShowMore(!showMore)}
                >
                    <Menu size={20} />
                    <span className={styles.label}>Mas</span>
                </button>
            </nav>
        </>
    )
}
