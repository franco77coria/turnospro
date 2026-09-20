'use client'
import { useAuth } from '@/context/AuthContext'
import { User, Heart, Settings, HelpCircle, Globe, LogOut, ChevronRight, Moon } from 'lucide-react'
import Link from 'next/link'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import DarkModeToggle from '@/components/DarkModeToggle'
import ThemePicker from '@/components/ThemePicker'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
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

                    {/* Dark mode & Support */}
                    <div className={styles.menuCard}>
                        <div className={styles.menuItem} style={{ justifyContent: 'space-between', cursor: 'default' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <div className={styles.menuIcon}><Moon size={20} /></div>
                                <span className={styles.menuLabel}>Modo oscuro / claro</span>
                            </div>
                            <DarkModeToggle />
                        </div>
                    </div>

                    {/* Color de la app — preferencia personal del cliente */}
                    <div className={styles.menuCard} style={{ padding: 'var(--space-4)' }}>
                        <ColorDeLaApp />
                    </div>

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


/**
 * El cliente elige cómo ver SU app. Se guarda en el perfil para que lo
 * acompañe entre dispositivos; el ThemePicker ya lo aplicó en pantalla apenas
 * lo eligió, así que acá solo hay que persistirlo.
 */
function ColorDeLaApp() {
    const { user, profile, refreshProfile } = useAuth()
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState('')

    const guardar = async (tema) => {
        if (!supabase || !user?.id) return
        setGuardando(true)
        setError('')
        try {
            const { error: err } = await supabase
                .from('profiles')
                .update({ preferences: { ...(profile?.preferences || {}), theme: tema } })
                .eq('id', user.id)
            if (err) throw err
            await refreshProfile()
        } catch (err) {
            console.error('Error al guardar el color:', err)
            // Sin esto el color se veía aplicado pero no sobrevivía a recargar,
            // y no había forma de saber que el guardado había fallado.
            setError('No se pudo guardar. El color se ve ahora, pero puede volver atrás.')
        }
        setGuardando(false)
    }

    return (
        <>
            <ThemePicker
                valor={profile?.preferences?.theme ?? null}
                onChange={guardar}
                descripcion="Cambia cómo ves la app en todos tus dispositivos."
            />
            {guardando && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                    Guardando…
                </p>
            )}
            {error && (
                <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 'var(--space-2)' }}>{error}</p>
            )}
        </>
    )
}
