'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, Scissors, Sparkles, Hand, Eye, Heart, Stethoscope, PawPrint, Wrench, Store, Star } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import styles from './explore.module.css'

const CATEGORIES = [
    { key: 'barberia', name: 'Barberia', icon: Scissors },
    { key: 'peluqueria', name: 'Peluqueria', icon: Scissors },
    { key: 'unas', name: 'Unas', icon: Hand },
    { key: 'lash', name: 'Lash & Cejas', icon: Eye },
    { key: 'spa', name: 'Spa & Estetica', icon: Sparkles },
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
        <div className={styles.explorePage}>
            <nav className={styles.nav}>
                <div className={styles.navInner}>
                    <Link href="/" className={styles.navLogo}>
                        <span className={styles.logoMark}>G</span>
                        GLOWUP
                    </Link>
                </div>
            </nav>

            <div className={styles.searchSection}>
                <form onSubmit={handleSearch} className={styles.searchBar}>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="Buscar negocios..."
                        value={query}
                        onChange={e => handleQueryChange(e.target.value)}
                    />
                    <button type="submit" className={styles.searchBtn}>
                        <Search size={16} />
                        Buscar
                    </button>
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
                                <Icon size={14} />
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
                        <p>Intenta con otro nombre o categoria</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.resultsCount}>
                            {businesses.length} negocio{businesses.length !== 1 ? 's' : ''} encontrado{businesses.length !== 1 ? 's' : ''}
                        </div>
                        <div className={styles.resultsGrid}>
                            {businesses.map(biz => (
                                <Link
                                    key={biz.id}
                                    href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                    className={styles.bizCard}
                                    style={{ padding: 0 }}
                                >
                                    <div style={{ height: 160, background: 'linear-gradient(135deg, var(--accent) 0%, #4F46E5 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 48, fontWeight: 800 }}>
                                        {(biz.name || '?')[0].toUpperCase()}
                                        {biz.avg_rating > 0 && (
                                            <div style={{ position: 'absolute', top: 12, right: 12, background: 'white', color: '#111', padding: '4px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                                <Star size={12} fill="#F59E0B" color="#F59E0B" /> {Number(biz.avg_rating).toFixed(1)} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>({biz.review_count})</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.bizInfo} style={{ padding: 'var(--space-4)' }}>
                                        <div className={styles.bizName} style={{ fontSize: 'var(--font-size-lg)' }}>{biz.name}</div>
                                        
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type} • {biz.services_count || 0} servicios
                                        </div>

                                        {biz.address && (
                                            <div className={styles.bizAddress} style={{ marginTop: 'var(--space-3)', color: 'var(--text-tertiary)' }}>
                                                <MapPin size={14} />
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
    )
}

export default function ExplorePage() {
    return (
        <Suspense fallback={
            <div className={styles.explorePage}>
                <div className={styles.loadingWrap}>
                    <div className="loading-spinner" />
                </div>
            </div>
        }>
            <ExploreContent />
        </Suspense>
    )
}
