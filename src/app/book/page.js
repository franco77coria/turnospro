'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Search, Star, Store, ChevronRight, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './book.module.css'

const RUBRO_LABELS = {
    barberia: 'Barbería', peluqueria: 'Peluquería', unas: 'Uñas',
    lash: 'Lash', spa: 'Spa', consultorio: 'Consultorio',
    veterinaria: 'Veterinaria', custom: 'Otro',
}

const CATEGORIES = [
    { key: 'barberia', name: 'Barbería' },
    { key: 'peluqueria', name: 'Peluquería' },
    { key: 'unas', name: 'Uñas' },
    { key: 'lash', name: 'Lash & Cejas' },
    { key: 'spa', name: 'Spa' },
    { key: 'consultorio', name: 'Consultorio' },
    { key: 'veterinaria', name: 'Veterinaria' },
]

function formatPrice(value) {
    return `$${Number(value).toLocaleString('es-AR')}`
}

function BizCard({ biz }) {
    const href = biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`
    const image = biz.cover_image_url || biz.logo_url
    return (
        <Link href={href} className={styles.bizCard}>
            <div className={styles.bizThumb}>
                {image ? (
                    <Image
                        src={image}
                        alt={`Local de ${biz.name}`}
                        fill
                        sizes="280px"
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    /* Sin foto va el nombre, no una inicial sobre un degradado */
                    <span className={styles.bizThumbName}>{biz.name}</span>
                )}
                {biz.open_status && (
                    <span className={`${styles.bizStatus} ${biz.open_status.open ? styles.bizOpen : ''}`}>
                        {biz.open_status.open ? 'Abierto' : 'Cerrado'}
                    </span>
                )}
            </div>
            <div className={styles.bizMeta}>
                <span className={styles.bizNameRow}>
                    {/* Sin foto el nombre ya es la portada: no se repite acá */}
                    {image && <span className={styles.bizName}>{biz.name}</span>}
                    {biz.avg_rating > 0 && biz.review_count > 0 && (
                        <span className={styles.bizRating}>
                            <Star size={12} fill="currentColor" strokeWidth={0} />
                            {Number(biz.avg_rating).toFixed(1)}
                        </span>
                    )}
                </span>
                <span className={styles.bizType}>
                    {RUBRO_LABELS[biz.business_type] || biz.business_type}
                    {biz.address && ` · ${biz.address}`}
                </span>
                {biz.price_from != null && (
                    <span className={styles.bizPrice}>desde <strong>{formatPrice(biz.price_from)}</strong></span>
                )}
            </div>
        </Link>
    )
}

function RebookCard({ apt }) {
    const biz = apt.business
    if (!biz) return null
    const href = biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.business_id || apt.business_id}`
    const [y, m, d] = (apt.date || '').split('-').map(Number)
    const dateStr = y ? new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : ''
    const image = biz.cover_image_url || biz.logo_url

    return (
        <Link href={href} className={styles.rebookCard}>
            <div className={styles.rebookThumb}>
                {image ? (
                    <Image
                        src={image}
                        alt={`Local de ${biz.name}`}
                        fill
                        sizes="64px"
                        style={{ objectFit: 'cover' }}
                    />
                ) : (
                    <span className={styles.rebookInitial}>{(biz.name || '?').trim()[0].toUpperCase()}</span>
                )}
            </div>
            <div className={styles.rebookInfo}>
                <span className={styles.rebookBizName}>{biz.name}</span>
                <span className={styles.rebookDetail}>
                    {apt.service_name}{dateStr && ` · ${dateStr}`}
                </span>
                <span className={styles.rebookCta}>Repetir turno <ArrowRight size={13} /></span>
            </div>
        </Link>
    )
}

function SkeletonCards({ count = 4 }) {
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
    const router = useRouter()
    const { user, profile, loading: authLoading } = useAuth()
    const [businesses, setBusinesses] = useState([])
    const [recentAppts, setRecentAppts] = useState([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')

    useEffect(() => {
        async function loadData() {
            // Mismo endpoint que /explore: trae el precio más bajo, el estado de
            // la agenda y el conteo real de servicios. Antes esta pantalla
            // consultaba `businesses` por su cuenta y no tenía nada de eso.
            try {
                const res = await fetch('/api/businesses/search?limit=12')
                const data = await res.json()
                setBusinesses(data.businesses || [])
            } catch {
                setBusinesses([])
            }

            if (user && supabase) {
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

    function handleSearch(e) {
        e.preventDefault()
        const q = query.trim()
        router.push(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
    }

    const firstName = profile?.full_name?.trim().split(' ')[0]
    // El nombre va dentro del título, no como etiqueta suelta encima
    const heading = firstName ? `${firstName}, ¿qué te hacés hoy?` : '¿Qué te hacés hoy?'

    const content = (
        <div className={styles.bookPage}>
            <section className={styles.hero}>
                <h1 className={styles.heroTitle}>{heading}</h1>
                <p className={styles.heroLede}>
                    Barberías, peluquerías y estudios que reservás online. Sin llamar, sin esperar respuesta.
                </p>

                <form className={styles.searchForm} onSubmit={handleSearch} role="search">
                    <Search size={20} className={styles.searchIcon} aria-hidden="true" />
                    <input
                        className={styles.searchInput}
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscá un lugar o un tratamiento"
                        aria-label="Buscar negocios"
                    />
                    <button type="submit" className={styles.searchSubmit}>Buscar</button>
                </form>

                <nav className={styles.pills} aria-label="Rubros">
                    {CATEGORIES.map(cat => (
                        <Link key={cat.key} href={`/explore?type=${cat.key}`} className={styles.pill}>
                            {cat.name}
                        </Link>
                    ))}
                </nav>
            </section>

            {loading ? (
                <div className={styles.sections}>
                    <div className={styles.section}>
                        <h2 className={styles.sectionTitle}>Cerca tuyo</h2>
                        <SkeletonCards />
                    </div>
                </div>
            ) : (
                <div className={styles.sections}>
                    {recentAppts.length > 0 && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Volver a reservar</h2>
                            <div className={styles.scrollRow}>
                                {recentAppts.map(apt => <RebookCard key={apt.id} apt={apt} />)}
                            </div>
                        </div>
                    )}

                    {businesses.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Cerca tuyo</h2>
                                <Link href="/explore" className={styles.seeAll}>
                                    Ver todo <ChevronRight size={14} />
                                </Link>
                            </div>
                            <div className={styles.scrollRow}>
                                {businesses.slice(0, 8).map(biz => <BizCard key={biz.id} biz={biz} />)}
                            </div>
                        </div>
                    )}

                    {businesses.length === 0 && recentAppts.length === 0 && (
                        <div className={styles.emptyState}>
                            <Store size={32} />
                            <h3>Todavía no hay negocios publicados</h3>
                            <p>En cuanto se sumen, van a aparecer acá.</p>
                        </div>
                    )}
                </div>
            )}

            {!user && !authLoading && (
                <div className={styles.loginPrompt}>
                    <p>Iniciá sesión para ver tus turnos y volver a reservar en un toque.</p>
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
