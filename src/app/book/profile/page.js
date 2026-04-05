'use client'
import { useAuth } from '@/context/AuthContext'
import { User, Heart, Settings, HelpCircle, Globe, LogOut, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './profile.module.css'

const MENU_ITEMS = [
    { icon: User, label: 'Perfil', href: null, section: 'main' },
    { icon: Heart, label: 'Favoritos', href: '/book/favorites', section: 'main' },
    { icon: Settings, label: 'Ajustes', href: null, section: 'main' },
]

const SUPPORT_ITEMS = [
    { icon: HelpCircle, label: 'Ayuda', href: null },
    { icon: Globe, label: 'español (Argentina)', href: null },
]

export default function ProfilePage() {
    const { user, profile, loading, signOut } = useAuth()

    if (loading) {
        return (
            <ConsumerLayout>
                <div className={styles.page}>
                    <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                </div>
            </ConsumerLayout>
        )
    }

    if (!user) {
        return (
            <ConsumerLayout>
                <div className={styles.page}>
                    <div className={styles.container}>
                        <div className={styles.authCard}>
                            <User size={40} style={{ color: 'var(--accent)', marginBottom: 'var(--space-3)' }} />
                            <h2>Iniciá sesión</h2>
                            <p>Accedé a tu perfil, favoritos e historial</p>
                            <div className={styles.authBtns}>
                                <Link href="/login?redirect=/book/profile" className="btn btn-primary btn-lg">Iniciar sesión</Link>
                                <Link href="/register?redirect=/book/profile" className="btn btn-secondary btn-lg">Crear cuenta</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </ConsumerLayout>
        )
    }

    const displayName = profile?.full_name || user.email?.split('@')[0] || 'Usuario'
    const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

    return (
        <ConsumerLayout>
            <div className={styles.page}>
                <div className={styles.container}>
                    {/* User info */}
                    <div className={styles.userHeader}>
                        <div className={styles.userInfo}>
                            <h1 className={styles.userName}>{displayName}</h1>
                            <p className={styles.userSub}>Perfil personal</p>
                        </div>
                        <div className={styles.avatar}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={displayName} />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>
                    </div>

                    {/* Main menu */}
                    <div className={styles.menuCard}>
                        {MENU_ITEMS.map((item, i) => {
                            const Icon = item.icon
                            const inner = (
                                <>
                                    <div className={styles.menuIcon}><Icon size={20} /></div>
                                    <span className={styles.menuLabel}>{item.label}</span>
                                    <ChevronRight size={18} className={styles.menuArrow} />
                                </>
                            )
                            if (item.href) {
                                return <Link key={i} href={item.href} className={styles.menuItem}>{inner}</Link>
                            }
                            return <div key={i} className={`${styles.menuItem} ${styles.menuDisabled}`}>{inner}</div>
                        })}
                    </div>

                    {/* Support */}
                    <div className={styles.menuCard}>
                        {SUPPORT_ITEMS.map((item, i) => {
                            const Icon = item.icon
                            return (
                                <div key={i} className={`${styles.menuItem} ${styles.menuDisabled}`}>
                                    <div className={styles.menuIcon}><Icon size={20} /></div>
                                    <span className={styles.menuLabel}>{item.label}</span>
                                    <ChevronRight size={18} className={styles.menuArrow} />
                                </div>
                            )
                        })}
                    </div>

                    {/* Logout */}
                    <div className={styles.menuCard}>
                        <button className={styles.logoutBtn} onClick={signOut}>
                            <LogOut size={20} />
                            <span>Cerrar sesión</span>
                        </button>
                    </div>
                </div>
            </div>
        </ConsumerLayout>
    )
}
