'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, CalendarDays, User } from 'lucide-react'
import styles from './ConsumerNav.module.css'

const TABS = [
    { href: '/book', label: 'Inicio', icon: Home, exact: true },
    { href: '/explore', label: 'Buscar', icon: Search },
    { href: '/book/my-appointments', label: 'Citas', icon: CalendarDays },
    { href: '/book/profile', label: 'Perfil', icon: User },
]

export default function ConsumerNav() {
    const pathname = usePathname()

    const isActive = (tab) => {
        if (tab.exact) return pathname === tab.href
        return pathname.startsWith(tab.href)
    }

    return (
        <nav className={styles.nav}>
            <div className={styles.inner}>
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const active = isActive(tab)
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`${styles.tab} ${active ? styles.active : ''}`}
                        >
                            <div className={`${styles.iconWrap} ${active ? styles.iconActive : ''}`}>
                                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                            </div>
                            <span className={styles.label}>{tab.label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
