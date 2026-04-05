'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, CalendarDays, User } from 'lucide-react'
import styles from './ConsumerNav.module.css'

const NAV_ITEMS = [
    { label: 'Inicio', icon: Home, href: '/book' },
    { label: 'Buscar', icon: Search, href: '/explore' },
    { label: 'Citas', icon: CalendarDays, href: '/book/my-appointments' },
    { label: 'Perfil', icon: User, href: '/book/profile' },
]

export default function ConsumerNav() {
    const pathname = usePathname()

    // Determine active index for the sliding active indicator
    const activeIndex = NAV_ITEMS.findIndex(item => pathname?.startsWith(item.href))
    // Fallback: If no match, index is -1
    const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex

    return (
        <div className={styles.islandWrapper}>
            <nav className={styles.navIsland}>
                <div 
                    className={styles.activePill} 
                    style={{ transform: `translateX(${safeActiveIndex * 100}%)` }} 
                />
                
                {NAV_ITEMS.map((item, index) => {
                    const Icon = item.icon
                    const isActive = pathname?.startsWith(item.href)

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            aria-label={item.label}
                        >
                            <div className={styles.iconWrapper}>
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={styles.label}>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}
