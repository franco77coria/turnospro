'use client'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
    Search, CalendarDays, Bell, Palette, Users, Wallet, UserCircle,
    Scissors, Sparkles, Hand, Eye, Stethoscope, PawPrint, Wrench,
    ArrowRight, Clock, ShieldCheck, Zap
} from 'lucide-react'
import styles from './page.module.css'

const CATEGORIES = [
    { key: 'barberia', name: 'Barberia', icon: Scissors, desc: 'Cortes, barba y mas' },
    { key: 'peluqueria', name: 'Peluqueria', icon: Scissors, desc: 'Corte, color, brushing' },
    { key: 'unas', name: 'Unas', icon: Hand, desc: 'Manicura, pedicura, nail art' },
    { key: 'lash', name: 'Lash & Cejas', icon: Eye, desc: 'Extensiones, lifting, diseno' },
    { key: 'spa', name: 'Spa & Estetica', icon: Sparkles, desc: 'Masajes, faciales, tratamientos' },
    { key: 'consultorio', name: 'Consultorio', icon: Stethoscope, desc: 'Consultas y turnos medicos' },
    { key: 'veterinaria', name: 'Veterinaria', icon: PawPrint, desc: 'Consultas, vacunas, bano' },
    { key: 'custom', name: 'Otro', icon: Wrench, desc: 'Cualquier emprendimiento' },
]

const FEATURES = [
    { icon: CalendarDays, title: 'Agenda inteligente', desc: 'Calendario visual con vista dia, semana y mes.' },
    { icon: Bell, title: 'Notificaciones', desc: 'Recordatorios automaticos para tus clientes.' },
    { icon: Palette, title: 'Personalizacion', desc: 'Adapta servicios, roles y marca a tu rubro.' },
    { icon: Users, title: 'Portal de clientes', desc: 'Tus clientes reservan online, 24/7.' },
    { icon: Wallet, title: 'Caja y finanzas', desc: 'Ingresos, gastos y cierre de caja.' },
    { icon: UserCircle, title: 'Equipo y roles', desc: 'Gestiona tu equipo con permisos.' },
]

const STATS = [
    { icon: Clock, value: '24/7', label: 'Reservas online' },
    { icon: Zap, value: '2 min', label: 'Para configurar' },
    { icon: ShieldCheck, value: '100%', label: 'Gratis para siempre' },
]

export default function Landing() {
    const { user } = useAuth()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')

    function handleSearch(e) {
        e.preventDefault()
        router.push(`/explore${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)
    }

    return (
        <div className={styles.landing}>
            {/* Navbar */}
            <nav className={styles.nav}>
                <div className={styles.navInner}>
                    <Link href="/" className={styles.navLogo}>
                        <span className={styles.logoMark}>G</span>
                        <span className={styles.logoText}>GLOWUP</span>
                    </Link>
                    <div className={styles.navLinks}>
                        <Link href="/explore" className={styles.navLink}>Explorar</Link>
                        <a href="#business" className={styles.navLink}>Para negocios</a>
                        {user ? (
                            <Link href="/dashboard" className="btn btn-primary">Mi Dashboard</Link>
                        ) : (
                            <Link href="/login" className="btn btn-primary">Ingresar</Link>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Reserva tu proximo<br /><span className={styles.heroAccent}>turno</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Encuentra barberías, peluquerías, spas y mas. Reserva en segundos.
                    </p>
                    <form onSubmit={handleSearch} className={styles.searchBar}>
                        <div className={styles.searchIcon}>
                            <Search size={18} />
                        </div>
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Buscar negocio o servicio..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className={styles.searchBtn}>Buscar</button>
                    </form>
                    <div className={styles.categoryPills}>
                        {CATEGORIES.slice(0, 6).map(cat => {
                            const Icon = cat.icon
                            return (
                                <Link
                                    key={cat.key}
                                    href={`/explore?type=${cat.key}`}
                                    className={styles.categoryPill}
                                >
                                    <Icon size={14} />
                                    {cat.name}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Categories */}
            <section className={styles.categories}>
                <div className={styles.sectionInner}>
                    <div className={styles.sectionHeader}>
                        <h2>Explora por categoria</h2>
                        <p>Encontra el lugar perfecto para vos.</p>
                    </div>
                    <div className={styles.categoryGrid}>
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon
                            return (
                                <Link key={cat.key} href={`/explore?type=${cat.key}`} className={styles.categoryCard}>
                                    <div className={styles.categoryIcon}>
                                        <Icon size={24} />
                                    </div>
                                    <span className={styles.categoryName}>{cat.name}</span>
                                    <span className={styles.categoryDesc}>{cat.desc}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className={styles.statsStrip}>
                {STATS.map((s, i) => {
                    const Icon = s.icon
                    return (
                        <div key={i} className={styles.statItem}>
                            <Icon size={20} className={styles.statIcon} />
                            <span className={styles.statValue}>{s.value}</span>
                            <span className={styles.statLabel}>{s.label}</span>
                        </div>
                    )
                })}
            </section>

            {/* Business section */}
            <section id="business" className={styles.businessSection}>
                <div className={styles.sectionInner}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTag}>Para negocios</div>
                        <h2>Gestiona tu negocio con GLOWUP</h2>
                        <p>Todo lo que necesitas en una sola plataforma. Gratis.</p>
                    </div>
                    <div className={styles.featureGrid}>
                        {FEATURES.map((f, i) => {
                            const Icon = f.icon
                            return (
                                <div key={i} className={styles.featureCard}>
                                    <div className={styles.featureIcon}>
                                        <Icon size={20} />
                                    </div>
                                    <h3>{f.title}</h3>
                                    <p>{f.desc}</p>
                                </div>
                            )
                        })}
                    </div>
                    <div className={styles.businessCTA}>
                        <Link href={user ? '/dashboard' : '/login'} className="btn btn-primary btn-lg">
                            {user ? 'Ir al Dashboard' : 'Empezar gratis'} <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerInner}>
                    <div className={styles.footerLeft}>
                        <span className={styles.footerLogo}>
                            <span className={styles.logoMark}>G</span> GLOWUP
                        </span>
                    </div>
                    <div className={styles.footerLinks}>
                        <Link href="/explore">Explorar</Link>
                        <Link href="/login">Ingresar</Link>
                        <Link href="/register">Registrarse</Link>
                    </div>
                    <div className={styles.footerRight}>
                        <span className={styles.footerText}>&copy; 2026 GLOWUP</span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
