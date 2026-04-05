'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, Scissors, Sparkles, Hand, Eye, Heart, Stethoscope, PawPrint, Wrench, Store, Star, SlidersHorizontal } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import styles from './explore.module.css'

const CATEGORIES = [
    { key: 'barberia', name: 'Barbería', icon: Scissors },
    { key: 'peluqueria', name: 'Peluquería', icon: Scissors },
    { key: 'unas', name: 'Uñas', icon: Hand },
    { key: 'lash', name: 'Lash & Cejas', icon: Eye },
    { key: 'spa', name: 'Spa & Estética', icon: Sparkles },
    { key: 'consultorio', name: 'Consultorio', icon: Stethoscope },
    { key: 'veterinaria', name: 'Veterinaria', icon: PawPrint },
    { key: 'custom', name: 'Otro', icon: Wrench },
]

function ExploreContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [query, setQuery] = useState(searchParams.get('q') || '')
    const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
    const [businesses, setBusinesses] = useState([])
    const [loading, setLoading] = useState(true)
    const debounceRef = useRef(null)

    function // eslint-disable-next-line
        fetchBusinesses(q, type) {
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
        // eslint-disable-next-line
        fetchBusinesses(searchParams.get('q') || '', searchParams.get('type') || '')
    }, [])

    function handleSearch(e) {
        e?.preventDefault?.()
        const params = new URLSearchParams()
        if (query) params.set('q', query)
        if (typeFilter) params.set('type', typeFilter)
        router.replace(`/explore?${params.toString()}`, { scroll: false })
        // eslint-disable-next-line
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
            // eslint-disable-next-line
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
        // eslint-disable-next-line
        fetchBusinesses(query, newType)
    }

    return (
        <ConsumerLayout>
            <div className={styles.explorePage}>
                {/* Search section — sticky on mobile */}
                <div className={styles.searchSection}>
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
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon
                            return (
                                <button
                                    key={cat.key}
                                    className={`${styles.categoryPill} ${typeFilter === cat.key ? styles.active : ''}`}
                                    onClick={() => handleTypeFilter(cat.key)}
                                >
                                    {cat.name}
                                </button>
                            )
                        })}
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
                            <div className={styles.resultsCount}>
                                {businesses.length} establecimiento{businesses.length !== 1 ? 's' : ''} encontrado{businesses.length !== 1 ? 's' : ''}
                            </div>
                            <div className={styles.resultsGrid}>
                                {businesses.map(biz => (
                                    <Link
                                        key={biz.id}
                                        href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                        className={styles.bizCard}
                                    >
                                        <div className={styles.bizCardImage}>
                                            {biz.cover_image_url ? (
                                                <img src={biz.cover_image_url} alt={biz.name} />
                                            ) : (
                                                <span className={styles.bizCardInitial}>
                                                    {(biz.name || '?')[0].toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.bizInfo}>
                                            <div className={styles.bizNameRow}>
                                                <span className={styles.bizName}>{biz.name}</span>
                                                {biz.avg_rating > 0 && (
                                                    <span className={styles.bizRating}>
                                                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                                                        {Number(biz.avg_rating).toFixed(1)}
                                                        <span className={styles.bizReviewCount}>({biz.review_count})</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.bizMeta}>
                                                {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}
                                                {biz.services_count > 0 && ` · ${biz.services_count} servicios`}
                                            </div>
                                            {biz.address && (
                                                <div className={styles.bizAddress}>
                                                    <MapPin size={13} />
                                                    {biz.address}
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
