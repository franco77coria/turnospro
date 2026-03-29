'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { MapPin, CalendarDays, ArrowRight, Store, History, Heart, LogOut, Search, X } from 'lucide-react'
import Link from 'next/link'
import styles from './book.module.css'

const RUBRO_LABELS = {
    barberia: 'Barbería',
    peluqueria: 'Peluquería',
    unas: 'Uñas',
    lash: 'Lash',
    spa: 'Spa',
    consultorio: 'Consultorio',
    veterinaria: 'Veterinaria',
    custom: 'Otro',
}

export default function BookListPage() {
    const { user, loading: authLoading, signOut } = useAuth()
    const [businesses, setBusinesses] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedRubro, setSelectedRubro] = useState('')

    async function loadBusinesses() {
        if (!supabase) { setLoading(false); return }
        const { data } = await supabase
            .from('businesses')
            .select('id, name, business_type, address, phone, services')
            .order('name')
        setBusinesses(data || [])
        setLoading(false)
    }

    useEffect(() => {
        loadBusinesses()
    }, [])

    const rubros = [...new Set(businesses.map(b => b.business_type).filter(Boolean))]

    const filtered = businesses.filter(biz => {
        const q = search.toLowerCase()
        const matchesSearch = !search ||
            biz.name?.toLowerCase().includes(q) ||
            biz.address?.toLowerCase().includes(q)
        const matchesRubro = !selectedRubro || biz.business_type === selectedRubro
        return matchesSearch && matchesRubro
    })

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
                </div>

                <div className={styles.pageHeader}>
                    <h1>Reservar turno</h1>
                    <p>Encontrá tu negocio y agendá tu turno</p>
                </div>

                {/* Buscador */}
                <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
                    <Search size={16} style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input
                        className="input"
                        style={{ paddingLeft: 'calc(var(--space-3) + 22px)', paddingRight: search ? 'calc(var(--space-3) + 22px)' : undefined }}
                        placeholder="Buscar por nombre o zona..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Filtros por rubro */}
                {rubros.length > 0 && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                        <button
                            onClick={() => setSelectedRubro('')}
                            style={{
                                padding: 'var(--space-1) var(--space-3)',
                                borderRadius: 'var(--radius-full)',
                                border: '1px solid',
                                borderColor: !selectedRubro ? 'var(--accent)' : 'var(--border)',
                                background: !selectedRubro ? 'var(--accent)' : 'transparent',
                                color: !selectedRubro ? '#fff' : 'var(--text-secondary)',
                                fontSize: 'var(--font-size-sm)',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            Todos
                        </button>
                        {rubros.map(rubro => (
                            <button
                                key={rubro}
                                onClick={() => setSelectedRubro(selectedRubro === rubro ? '' : rubro)}
                                style={{
                                    padding: 'var(--space-1) var(--space-3)',
                                    borderRadius: 'var(--radius-full)',
                                    border: '1px solid',
                                    borderColor: selectedRubro === rubro ? 'var(--accent)' : 'var(--border)',
                                    background: selectedRubro === rubro ? 'var(--accent)' : 'transparent',
                                    color: selectedRubro === rubro ? '#fff' : 'var(--text-secondary)',
                                    fontSize: 'var(--font-size-sm)',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {RUBRO_LABELS[rubro] || rubro}
                            </button>
                        ))}
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Store size={32} />
                        <p>{search || selectedRubro ? 'No se encontraron negocios con ese filtro' : 'No hay negocios disponibles todavía'}</p>
                        {(search || selectedRubro) && (
                            <button
                                onClick={() => { setSearch(''); setSelectedRubro('') }}
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: 'var(--space-3)' }}
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className={styles.businessGrid}>
                        {filtered.map(biz => (
                            <Link key={biz.id} href={`/book/${biz.id}`} className={styles.businessCard}>
                                <div className={styles.bizAvatar}>
                                    {biz.name?.[0]?.toUpperCase()}
                                </div>
                                <div className={styles.bizInfo}>
                                    <h3>{biz.name}</h3>
                                    <span className={styles.bizType}>{RUBRO_LABELS[biz.business_type] || biz.business_type}</span>
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
