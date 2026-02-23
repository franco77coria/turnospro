'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, Clock, Wallet, Settings } from 'lucide-react'
import styles from './MobileNav.module.css'

const ITEMS = [
    { href: '/dashboard', label: 'Inicio', icon: BarChart3 },
    { href: '/dashboard/calendar', label: 'Agenda', icon: CalendarDays },
    { href: '/dashboard/appointments', label: 'Turnos', icon: Clock },
    { href: '/dashboard/finance', label: 'Caja', icon: Wallet },
    { href: '/dashboard/settings', label: 'Más', icon: Settings },
]

export default function MobileNav() {
    const pathname = usePathname()

    const isActive = (href) => {
        if (href === '/dashboard') return pathname === '/dashboard'
        return pathname.startsWith(href)
    }

    return (
        <nav className={styles.mobileNav}>
            {ITEMS.map(item => {
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
        </nav>
    )
}
