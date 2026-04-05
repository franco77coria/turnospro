'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Search, Star, MapPin, Store, ChevronRight, CalendarDays, Clock } from 'lucide-react'
import Link from 'next/link'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './book.module.css'

const RUBRO_LABELS = {
    barberia: 'Barbería', peluqueria: 'Peluquería', unas: 'Uñas',
    lash: 'Lash', spa: 'Spa', consultorio: 'Consultorio',
    veterinaria: 'Veterinaria', custom: 'Otro',
}

function BizCardSmall({ biz, className = '' }) {
    const href = biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`
    return (
        <Link href={href} className={`${styles.bizCardSmall} ${className}`}>
            <div className={styles.bizThumb}>
                {biz.cover_image_url || biz.logo_url ? (
                    <img src={biz.cover_image_url || biz.logo_url} alt={biz.name} />
                ) : (
                    <span className={styles.bizInitial}>{(biz.name || '?')[0].toUpperCase()}</span>
                )}
            </div>
            <div className={styles.bizMeta}>
                <span className={styles.bizName}>{biz.name}</span>
                {biz.avg_rating > 0 && (
                    <span className={styles.bizRating}>
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        {Number(biz.avg_rating).toFixed(1)}
                        <span className={styles.bizReviewCount}>({biz.total_reviews})</span>
                    </span>
                )}
                {biz.address && (
                    <span className={styles.bizAddr}>
                        {biz.address.length > 30 ? biz.address.slice(0, 30) + '...' : biz.address}
                    </span>
                )}
                <span className={styles.bizType}>{RUBRO_LABELS[biz.business_type] || biz.business_type}</span>
            </div>
        </Link>
    )
}

function RebookCard({ apt }) {
    const biz = apt.business
    if (!biz) return null
    const href = biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.business_id || apt.business_id}`
    const dateObj = new Date(apt.date + 'T12:00:00')
    const dateStr = dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <Link href={href} className={styles.rebookCard}>
            <div className={styles.rebookThumb}>
                {biz.cover_image_url || biz.logo_url ? (
                    <img src={biz.cover_image_url || biz.logo_url} alt={biz.name} />
                ) : (
                    <span className={styles.bizInitial}>{(biz.name || '?')[0].toUpperCase()}</span>
                )}
            </div>
            <div className={styles.rebookInfo}>
                <span className={styles.rebookBizName}>{biz.name}</span>
                <span className={styles.rebookDate}>{dateStr}</span>
                <span className={styles.rebookService}>
                    {apt.price != null && `$${Number(apt.price).toLocaleString()}`}
                    {apt.price != null && apt.service_name && ' · '}
                    {apt.service_name && '1 artículo'}
                </span>
                <span className={styles.rebookCta}>Volver a reservar</span>
            </div>
        </Link>
    )
}

function SkeletonCards({ count = 3 }) {
    return (
        <div className={styles.scrollRow}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                    <div className={styles.skeletonThumb} />
                    <div className={styles.skeletonLines}>
                        <div className={styles.skeletonLine} style={{ width: '70%' }} />
                        <div className={styles.skeletonLine} style={{ width: '40%' }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function BookListPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [businesses, setBusinesses] = useState([])
    const [recentAppts, setRecentAppts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadData() {
            if (!supabase) { setLoading(false); return }

            // Load businesses
            const { data: bizData } = await supabase
                .from('businesses')
                .select('id, name, slug, business_type, address, phone, services, cover_image_url, logo_url, avg_rating, total_reviews')
                .order('avg_rating', { ascending: false })
                .limit(20)

            setBusinesses(bizData || [])

            // Load recent appointments if logged in
            if (user) {
                const { data: clientRecords } = await supabase
                    .from('clients')
                    .select('id, business_id')
                    .eq('email', user.email)

                if (clientRecords?.length) {
                    const clientIds = clientRecords.map(c => c.id)
                    const businessIds = [...new Set(clientRecords.map(c => c.business_id))]

                    const { data: appts } = await supabase
                        .from('appointments')
                        .select('id, business_id, service_name, date, time, price, status')
                        .in('client_id', clientIds)
                        .in('status', ['completed', 'confirmed'])
                        .order('date', { ascending: false })
                        .limit(5)

                    if (appts?.length) {
                        const { data: apptBizData } = await supabase
                            .from('businesses')
                            .select('id, name, slug, cover_image_url, logo_url, business_type')
                            .in('id', businessIds)

                        const bizMap = {}
                        apptBizData?.forEach(b => { bizMap[b.id] = b })
                        setRecentAppts(appts.map(a => ({ ...a, business: bizMap[a.business_id] || null })))
                    }
                }
            }

            setLoading(false)
        }

        loadData()
    }, [user])

    const greeting = profile?.full_name
        ? `Hola, ${profile.full_name.split(' ')[0]}`
        : 'Para ti'

    const content = (
        <div className={styles.bookPage}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>{greeting}</h1>
                <Link href="/explore" className={styles.searchIcon} aria-label="Buscar">
                    <Search size={22} />
                </Link>
            </div>

            {loading ? (
                <div className={styles.sections}>
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Recomendado</h2>
                        <SkeletonCards />
                    </div>
                </div>
            ) : (
                <div className={styles.sections}>
                    {/* Volver a reservar */}
                    {recentAppts.length > 0 && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Volver a reservar</h2>
                            <div className={styles.scrollRow}>
                                {recentAppts.map(apt => (
                                    <RebookCard key={apt.id} apt={apt} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recomendado */}
                    {businesses.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Recomendado</h2>
                                <Link href="/explore" className={styles.seeAll}>
                                    Ver todo <ChevronRight size={14} />
                                </Link>
                            </div>
                            <div className={styles.scrollRow}>
                                {businesses.slice(0, 8).map(biz => (
                                    <BizCardSmall key={biz.id} biz={biz} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All businesses fallback */}
                    {businesses.length === 0 && recentAppts.length === 0 && (
                        <div className={styles.emptyState}>
                            <Store size={40} />
                            <h3>No hay negocios disponibles todavía</h3>
                            <p>Cuando se registren negocios, los verás acá.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Not logged in prompt */}
            {!user && !authLoading && (
                <div className={styles.loginPrompt}>
                    <p>Iniciá sesión para ver tus reservas y favoritos</p>
                    <div className={styles.loginBtns}>
                        <Link href="/login?redirect=/book" className="btn btn-primary">Iniciar sesión</Link>
                        <Link href="/register?redirect=/book" className="btn btn-secondary">Crear cuenta</Link>
                    </div>
                </div>
            )}
        </div>
    )

    return <ConsumerLayout>{content}</ConsumerLayout>
}
