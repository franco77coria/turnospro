'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Heart, MapPin, ArrowLeft, Store, ArrowRight, Star } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import Link from 'next/link'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './favorites.module.css'

export default function FavoritesPage() {
    const { user, loading: authLoading } = useAuth()
    const [favorites, setFavorites] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchFavorites = useCallback(async () => {
        try {
            const res = await fetch(`/api/favorites?user_id=${user.id}`)
            const data = await res.json()
            setFavorites(data.favorites || [])
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }, [user])

    useEffect(() => {
        if (user) fetchFavorites()
        else setLoading(false)
    }, [user, fetchFavorites])

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
                            <Heart size={32} style={{ color: '#EF4444' }} />
                            <h2>Iniciá sesión para ver tus favoritos</h2>
                            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                <Link href="/login" className="btn btn-primary">Iniciar sesión</Link>
                                <Link href="/register" className="btn btn-secondary">Crear cuenta</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </ConsumerLayout>
        )
    }

    return (
        <ConsumerLayout>
            <div className={styles.page}>
                <div className={styles.container}>
                    {/* Header */}
                    <div className={styles.header}>
                        <Link href="/book/profile" className={styles.backBtn}>
                            <ArrowLeft size={18} />
                        </Link>
                        <h1>Favoritos</h1>
                    </div>

                    {loading ? (
                        <div className={styles.loadingWrap}><div className="loading-spinner" /></div>
                    ) : favorites.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Heart size={40} />
                            <h3>No tenés favoritos aún</h3>
                            <p>Explorá negocios y guardá los que más te gusten</p>
                            <Link href="/explore" className="btn btn-primary">Explorar negocios</Link>
                        </div>
                    ) : (
                        <div className={styles.favList}>
                            {favorites.map(fav => {
                                const biz = fav.businesses
                                if (!biz) return null
                                return (
                                    <div key={fav.id} className={styles.favCard}>
                                        <Link
                                            href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                            className={styles.favMain}
                                        >
                                            <div className={styles.favThumb}>
                                                {biz.cover_image_url || biz.logo_url ? (
                                                    <img src={biz.cover_image_url || biz.logo_url} alt={biz.name} />
                                                ) : (
                                                    <span>{(biz.name || '?')[0].toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className={styles.favInfo}>
                                                <span className={styles.favName}>{biz.name}</span>
                                                <span className={styles.favType}>
                                                    {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}
                                                </span>
                                                {biz.address && (
                                                    <span className={styles.favAddr}>
                                                        <MapPin size={12} /> {biz.address}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                        <div className={styles.favActions}>
                                            <Link
                                                href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                                className={styles.bookBtn}
                                            >
                                                Reservar <ArrowRight size={13} />
                                            </Link>
                                            <button
                                                className={styles.removeBtn}
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
        </ConsumerLayout>
    )
}
