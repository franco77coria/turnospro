'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { MapPin, CalendarDays, ArrowRight, Store, History, Heart, LogOut } from 'lucide-react'
import Link from 'next/link'
import styles from './book.module.css'

export default function BookListPage() {
    const { user, loading: authLoading, signOut } = useAuth()
    const router = useRouter()
    const [businesses, setBusinesses] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadBusinesses()
    }, [])

    async function loadBusinesses() {
        if (!supabase) { setLoading(false); return }
        const { data } = await supabase
            .from('businesses')
            .select('id, name, business_type, address, phone, services')
            .order('name')
        setBusinesses(data || [])
        setLoading(false)
    }

    if (authLoading || loading) {
        return (
            <div className={styles.bookPage}>
                <div className={styles.loadingWrap}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className={styles.bookPage}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <Link href="/" className={styles.logo}>
                            <span className={styles.logoMark}>G</span>
                            <span className={styles.logoText}>GLOWUP</span>
                        </Link>
                    </div>
                    <div className={styles.authCard}>
                        <Store size={32} style={{ color: 'var(--accent)', marginBottom: 'var(--space-3)' }} />
                        <h2>Iniciá sesión para reservar</h2>
                        <p>Necesitás una cuenta para reservar turnos en GLOWUP.</p>
                        <div className={styles.authButtons}>
                            <Link href="/login?redirect=/book" className="btn btn-primary">Iniciar sesión</Link>
                            <Link href="/register?redirect=/book" className="btn btn-secondary">Crear cuenta</Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.bookPage}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoMark}>G</span>
                        <span className={styles.logoText}>GLOWUP</span>
                    </Link>
                    {user && (
                        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                            <Link href="/book/favorites" className={styles.myApptsLink}>
                                <Heart size={14} /> Favoritos
                            </Link>
                            <Link href="/book/my-appointments" className={styles.myApptsLink}>
                                <History size={14} /> Mis turnos
                            </Link>
                            <button onClick={async () => { await signOut(); window.location.href = '/login' }}
                                className={styles.myApptsLink}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-tertiary)' }}>
                                <LogOut size={14} /> Salir
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.pageHeader}>
                    <h1>Reservar turno</h1>
                    <p>Elegí un negocio para agendar tu turno</p>
                </div>

                {businesses.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Store size={32} />
                        <p>No hay negocios disponibles todavía</p>
                    </div>
                ) : (
                    <div className={styles.businessGrid}>
                        {businesses.map(biz => (
                            <Link key={biz.id} href={`/book/${biz.id}`} className={styles.businessCard}>
                                <div className={styles.bizAvatar}>
                                    {biz.name?.[0]?.toUpperCase()}
                                </div>
                                <div className={styles.bizInfo}>
                                    <h3>{biz.name}</h3>
                                    <span className={styles.bizType}>{biz.business_type}</span>
                                    {biz.address && (
                                        <span className={styles.bizAddress}>
                                            <MapPin size={12} /> {biz.address}
                                        </span>
                                    )}
                                    <span className={styles.bizServices}>
                                        <CalendarDays size={12} /> {biz.services?.length || 0} servicios
                                    </span>
                                </div>
                                <ArrowRight size={18} className={styles.bizArrow} />
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
