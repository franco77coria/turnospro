'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Heart, MapPin, ArrowLeft, Store, ArrowRight } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import Link from 'next/link'
import styles from '../my-appointments/my-appointments.module.css'

export default function FavoritesPage() {
    const { user, loading: authLoading } = useAuth()
    const [favorites, setFavorites] = useState([])
    const [loading, setLoading] = useState(true)

    async function fetchFavorites() {
        try {
            const res = await fetch(`/api/favorites?user_id=${user.id}`)
            const data = await res.json()
            setFavorites(data.favorites || [])
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    useEffect(() => {
        if (user) fetchFavorites()
        else setLoading(false)
    }, [user])

    async function toggleFavorite(businessId) {
        try {
            await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, business_id: businessId }),
            })
            setFavorites(prev => prev.filter(f => f.business_id !== businessId))
        } catch (err) {
            console.error(err)
        }
    }

    if (authLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.authCard}>
                        <Heart size={32} style={{ color: '#EF4444' }} />
                        <h2>Iniciá sesión para ver tus favoritos</h2>
                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Link href="/login" className="btn btn-primary">Iniciar sesión</Link>
                            <Link href="/register" className="btn btn-secondary">Crear cuenta</Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link href="/book" className={styles.backBtn}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1>Mis favoritos</h1>
                        <p>Negocios que guardaste</p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                ) : favorites.length === 0 ? (
                    <div className={styles.empty}>
                        <Heart size={40} />
                        <h3>No tenés favoritos aún</h3>
                        <p>Explorá negocios y guardá los que más te gusten</p>
                        <Link href="/explore" className="btn btn-primary">Explorar negocios</Link>
                    </div>
                ) : (
                    <div className={styles.appointmentList}>
                        {favorites.map(fav => {
                            const biz = fav.businesses
                            if (!biz) return null
                            const servicesCount = biz.services?.length || 0
                            return (
                                <div key={fav.id} className={styles.appointmentCard}>
                                    <div className={styles.appointmentTop}>
                                        <div className={styles.dateBlock} style={{ background: '#FEF2F2' }}>
                                            <Heart size={20} fill="#EF4444" color="#EF4444" />
                                        </div>
                                        <div className={styles.appointmentInfo}>
                                            <h3>{biz.name}</h3>
                                            <div className={styles.appointmentMeta}>
                                                <span className="badge badge-accent" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                    {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}
                                                </span>
                                                {servicesCount > 0 && (
                                                    <span>{servicesCount} servicio{servicesCount !== 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                            {biz.address && (
                                                <div className={styles.businessInfo}>
                                                    <MapPin size={12} />
                                                    <span>{biz.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.appointmentActions}>
                                        <Link
                                            href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                            className={styles.actionBtn}
                                        >
                                            Reservar turno <ArrowRight size={13} />
                                        </Link>
                                        <button
                                            className={`${styles.actionBtn} ${styles.cancelBtn}`}
                                            onClick={() => toggleFavorite(fav.business_id)}
                                        >
                                            <Heart size={13} /> Quitar
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
