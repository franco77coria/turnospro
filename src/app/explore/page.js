'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, Store, Star, ArrowLeft } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './explore.module.css'

const CATEGORIES = [
    { key: 'barberia', name: 'Barbería' },
    { key: 'peluqueria', name: 'Peluquería' },
    { key: 'unas', name: 'Uñas' },
    { key: 'lash', name: 'Lash & Cejas' },
    { key: 'spa', name: 'Spa & Estética' },
    { key: 'consultorio', name: 'Consultorio' },
    { key: 'veterinaria', name: 'Veterinaria' },
    { key: 'custom', name: 'Otro' },
]

function ExploreContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
    const [businesses, setBusinesses] = useState([])
    const [loading, setLoading] = useState(true)
    const debounceRef = useRef(null)

    function fetchBusinesses(q, type) {
        setLoading(true)
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (type) params.set('type', type)

        fetch(`/api/businesses/search?${params.toString()}`)
            .then(r => r.json())
            .then(data => {
                setBusinesses(data.businesses || [])
                setLoading(false)
            })
            .catch(() => {
                setBusinesses([])
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchBusinesses(searchParams.get('q') || '', searchParams.get('type') || '')
    }, [])

    function handleSearch(e) {
        e?.preventDefault?.()
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (typeFilter) params.set('type', typeFilter)
        router.replace(`/explore?${params.toString()}`, { scroll: false })
        fetchBusinesses(query, typeFilter)
    }

    function handleQueryChange(value) {
        setQuery(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            const params = new URLSearchParams()
            if (value) params.set('q', value)
            if (typeFilter) params.set('type', typeFilter)
            router.replace(`/explore?${params.toString()}`, { scroll: false })
            fetchBusinesses(value, typeFilter)
        }, 300)
    }

    function handleTypeFilter(key) {
        const newType = typeFilter === key ? '' : key
        setTypeFilter(newType)
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (newType) params.set('type', newType)
        router.replace(`/explore?${params.toString()}`, { scroll: false })
        fetchBusinesses(query, newType)
    }

    return (
        <ConsumerLayout>
            <div className={styles.explorePage}>
                {/* Search section — sticky on mobile */}
                <div className={styles.searchSection}>
                    <div className={styles.topHeader}>
                        <Link href="/dashboard" className={styles.backBtn} aria-label="Volver al Dashboard">
                            <ArrowLeft size={16} /> Volver al Dashboard
                        </Link>
                    </div>

                    <form onSubmit={handleSearch} className={styles.searchBar}>
                        <Search size={18} className={styles.searchBarIcon} />
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Todos los tratamientos"
                            value={query}
                            onChange={e => handleQueryChange(e.target.value)}
                        />
                    </form>

                    <div className={styles.categories}>
                        {CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    className={`${styles.categoryPill} ${typeFilter === cat.key ? styles.active : ''}`}
                                    onClick={() => handleTypeFilter(cat.key)}
                                >
                                    {cat.name}
                                </button>
                        ))}
                    </div>
                </div>

                <div className={styles.results}>
                    {loading ? (
                        <div className={styles.loadingWrap}>
                            <div className="loading-spinner" />
                        </div>
                    ) : businesses.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>
                                <Store size={28} />
                            </div>
                            <h3>No encontramos negocios</h3>
                            <p>Intentá con otro nombre o categoría</p>
                        </div>
                    ) : (
                        <>
                            <h2 className={styles.resultsCount}>
                                {businesses.length} {businesses.length === 1 ? 'lugar' : 'lugares'} para reservar
                            </h2>
                            <div className={styles.resultsGrid}>
                                {businesses.map(biz => (
                                    <Link
                                        key={biz.id}
                                        href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                        className={styles.bizCard}
                                    >
                                        <div className={styles.bizCardImage}>
                                            {/* Con foto, el nombre va debajo. Sin foto, el nombre ES
                                                la portada y no se repite abajo. */}
                                            {biz.cover_image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={biz.cover_image_url} alt={`Local de ${biz.name}`} loading="lazy" />
                                            ) : (
                                                /* Sin foto no se pinta un degradado con una letra: se
                                                   muestra el nombre, que es lo que el visitante busca. */
                                                <span className={styles.bizCardName}>{biz.name}</span>
                                            )}
                                            {biz.open_status && (
                                                <span className={`${styles.bizStatus} ${biz.open_status.open ? styles.bizOpen : ''}`}>
                                                    {biz.open_status.open ? 'Abierto' : 'Cerrado'}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.bizInfo}>
                                            <div className={styles.bizNameRow}>
                                                {biz.cover_image_url && (
                                                    <span className={styles.bizName}>{biz.name}</span>
                                                )}
                                                {biz.avg_rating > 0 && biz.review_count > 0 && (
                                                    <span className={styles.bizRating}>
                                                        <Star size={12} fill="currentColor" strokeWidth={0} />
                                                        {Number(biz.avg_rating).toFixed(1)}
                                                        <span className={styles.bizReviewCount}>({biz.review_count})</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.bizMeta}>
                                                {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}
                                                {biz.services_count > 0 && ` · ${biz.services_count} servicio${biz.services_count !== 1 ? 's' : ''}`}
                                            </div>
                                            {biz.address && (
                                                <div className={styles.bizAddress}>
                                                    <MapPin size={13} />
                                                    {biz.address}
                                                </div>
                                            )}
                                            {biz.price_from != null && (
                                                <div className={styles.bizPrice}>
                                                    desde <strong>${Number(biz.price_from).toLocaleString('es-AR')}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </ConsumerLayout>
    )
}

export default function ExplorePage() {
    return (
        <Suspense fallback={
            <ConsumerLayout>
                <div className={styles.explorePage}>
                    <div className={styles.loadingWrap}>
                        <div className="loading-spinner" />
                    </div>
                </div>
            </ConsumerLayout>
        }>
            <ExploreContent />
        </Suspense>
    )
}
