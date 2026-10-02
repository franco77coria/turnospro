'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Search, MapPin, Store, Star, ArrowLeft, Navigation, RefreshCw } from 'lucide-react'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import { buildMapQuery } from '@/lib/business-profile'
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
    const [loadError, setLoadError] = useState(false)
    const [selectedBusinessId, setSelectedBusinessId] = useState(null)
    const debounceRef = useRef(null)
    const requestRef = useRef(0)
    const mapRef = useRef(null)

    async function fetchBusinesses(q, type) {
        const requestId = ++requestRef.current
        setLoading(true)
        setLoadError(false)
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (type) params.set('type', type)

        try {
            const response = await fetch(`/api/businesses/search?${params.toString()}`)
            if (!response.ok) throw new Error('Search request failed')
            const data = await response.json()
            if (requestId !== requestRef.current) return
            const nextBusinesses = data.businesses || []
            setBusinesses(nextBusinesses)
            setSelectedBusinessId(current => {
                const currentStillExists = nextBusinesses.some(biz => biz.id === current && (biz.address || (biz.latitude != null && biz.longitude != null)))
                return currentStillExists
                    ? current
                    : nextBusinesses.find(biz => biz.address || (biz.latitude != null && biz.longitude != null))?.id || null
            })
        } catch {
            if (requestId !== requestRef.current) return
            setBusinesses([])
            setLoadError(true)
        } finally {
            if (requestId === requestRef.current) setLoading(false)
        }
    }

    useEffect(() => {
        fetchBusinesses(searchParams.get('q') || '', searchParams.get('type') || '')
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            requestRef.current += 1
        }
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

    const mapBusinesses = businesses.filter(biz => biz.address || (biz.latitude != null && biz.longitude != null))
    const selectedBusiness = mapBusinesses.find(biz => biz.id === selectedBusinessId) || mapBusinesses[0] || null
    const selectedMapQuery = selectedBusiness
        ? selectedBusiness.latitude != null && selectedBusiness.longitude != null
            ? `${selectedBusiness.latitude},${selectedBusiness.longitude}`
            : buildMapQuery(selectedBusiness.address)
        : null
    const directionsUrl = selectedMapQuery
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedMapQuery)}`
        : null

    function showOnMap(businessId) {
        setSelectedBusinessId(businessId)
        requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    return (
        <ConsumerLayout>
            <div className={styles.explorePage}>
                {/* Search section — sticky on mobile */}
                <div className={styles.searchSection}>
                    <div className={styles.topHeader}>
                        <Link href="/" className={styles.backBtn} aria-label="Volver al inicio">
                            <ArrowLeft size={16} /> Inicio
                        </Link>
                    </div>

                    <form onSubmit={handleSearch} className={styles.searchBar}>
                        <Search size={18} className={styles.searchBarIcon} />
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Buscar por nombre del local"
                            aria-label="Buscar negocios por nombre"
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
                    ) : loadError ? (
                        <div className={styles.emptyState} role="alert">
                            <div className={styles.emptyIcon}>
                                <Search size={28} />
                            </div>
                            <h3>No pudimos cargar los locales</h3>
                            <p>Revisá tu conexión y volvé a intentar.</p>
                            <button type="button" className="btn btn-secondary" onClick={() => fetchBusinesses(query, typeFilter)}>
                                <RefreshCw size={15} /> Reintentar
                            </button>
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
                            {selectedBusiness && selectedMapQuery && (
                                <section className={styles.mapSection} ref={mapRef} aria-labelledby="explore-map-title">
                                    <div className={styles.mapHeader}>
                                        <div>
                                            <h3 id="explore-map-title">Ubicación de {selectedBusiness.name}</h3>
                                            <p>{selectedBusiness.address || 'Ubicación cargada por el negocio'}</p>
                                        </div>
                                        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={styles.directionsLink}>
                                            <Navigation size={15} /> Cómo llegar
                                        </a>
                                    </div>
                                    {mapBusinesses.length > 1 && (
                                        <div className={styles.mapPicker} aria-label="Elegir un local para mostrar en el mapa">
                                            {mapBusinesses.map(biz => (
                                                <button
                                                    key={biz.id}
                                                    type="button"
                                                    className={biz.id === selectedBusiness.id ? styles.mapPickerActive : ''}
                                                    aria-pressed={biz.id === selectedBusiness.id}
                                                    onClick={() => setSelectedBusinessId(biz.id)}
                                                >
                                                    {biz.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className={styles.mapFrame}>
                                        <iframe
                                            key={selectedMapQuery}
                                            title={`Mapa de ${selectedBusiness.name}`}
                                            src={`https://www.google.com/maps?q=${encodeURIComponent(selectedMapQuery)}&output=embed&hl=es`}
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            allowFullScreen
                                        />
                                    </div>
                                </section>
                            )}
                            <div className={styles.resultsGrid}>
                                {businesses.map(biz => (
                                    <article key={biz.id} className={styles.bizCard}>
                                        <Link href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`} className={styles.bizMainLink}>
                                            <div className={styles.bizCardImage}>
                                            {/* Con foto, el nombre va debajo. Sin foto, el nombre ES
                                                la portada y no se repite abajo. */}
                                            {biz.cover_image_url ? (
                                                <Image
                                                    src={biz.cover_image_url}
                                                    alt={`Local de ${biz.name}`}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 320px"
                                                    style={{ objectFit: 'cover' }}
                                                />
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
                                        <div className={styles.bizActions}>
                                            <Link href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`} className={styles.bookLink}>
                                                Ver horarios
                                            </Link>
                                            {(biz.address || (biz.latitude != null && biz.longitude != null)) && (
                                                <button type="button" className={styles.mapButton} onClick={() => showOnMap(biz.id)}>
                                                    <MapPin size={14} /> Ver en mapa
                                                </button>
                                            )}
                                        </div>
                                    </article>
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
