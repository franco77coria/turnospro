import Link from 'next/link'
import {
    CalendarDays, Bell, Palette, Users, Wallet, UserCircle,
    Scissors, Sparkles, Hand, Eye, Stethoscope, PawPrint, Wrench,
    ArrowRight, Clock, ShieldCheck, Zap
} from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import NavAuth, { CTAButton } from '@/components/NavAuth'
import styles from './page.module.css'

const CATEGORIES = [
    { key: 'barberia', name: 'Barbería', icon: Scissors, desc: 'Cortes, barba y más' },
    { key: 'peluqueria', name: 'Peluquería', icon: Scissors, desc: 'Corte, color, brushing' },
    { key: 'unas', name: 'Uñas', icon: Hand, desc: 'Manicura, pedicura, nail art' },
    { key: 'lash', name: 'Lash & Cejas', icon: Eye, desc: 'Extensiones, lifting, diseño' },
    { key: 'spa', name: 'Spa & Estética', icon: Sparkles, desc: 'Masajes, faciales, tratamientos' },
    { key: 'consultorio', name: 'Consultorio', icon: Stethoscope, desc: 'Consultas y turnos médicos' },
    { key: 'veterinaria', name: 'Veterinaria', icon: PawPrint, desc: 'Consultas, vacunas, baño' },
    { key: 'custom', name: 'Otro', icon: Wrench, desc: 'Cualquier emprendimiento' },
]

const FEATURES = [
    { icon: CalendarDays, title: 'Agenda inteligente', desc: 'Calendario visual con vista día, semana y mes.' },
    { icon: Bell, title: 'Notificaciones', desc: 'Recordatorios automáticos para tus clientes.' },
    { icon: Palette, title: 'Personalización', desc: 'Adaptá servicios, roles y marca a tu rubro.' },
    { icon: Users, title: 'Portal de clientes', desc: 'Tus clientes reservan online, 24/7.' },
    { icon: Wallet, title: 'Caja y finanzas', desc: 'Ingresos, gastos y cierre de caja.' },
    { icon: UserCircle, title: 'Equipo y roles', desc: 'Gestioná tu equipo con permisos.' },
]

const STATS = [
    { icon: Clock, value: '24/7', label: 'Reservas online' },
    { icon: Zap, value: '2 min', label: 'Para configurar' },
    { icon: ShieldCheck, value: '100%', label: 'Gratis para siempre' },
]

// Server Component — renders static HTML (SEO-friendly)
// Interactive parts (SearchBar, NavAuth) are client components
export default function Landing() {
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
                        <NavAuth />
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Reservá tu próximo<br /><span className={styles.heroAccent}>turno</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Encontrá barberías, peluquerías, spas y más. Reservá en segundos.
                    </p>
                    <SearchBar />
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
                        <h2>Explorá por categoría</h2>
                        <p>Encontrá el lugar perfecto para vos.</p>
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
                        <h2>Gestioná tu negocio con GLOWUP</h2>
                        <p>Todo lo que necesitás en una sola plataforma. Gratis.</p>
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
                        <CTAButton />
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
