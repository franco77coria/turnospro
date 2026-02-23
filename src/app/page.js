'use client'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { CalendarDays, Bell, Palette, Users, Wallet, UserCircle, Scissors, Sparkles, Hand, Eye, Heart, Stethoscope, PawPrint, Wrench, ArrowRight } from 'lucide-react'
import styles from './page.module.css'

const FEATURES = [
  { icon: CalendarDays, title: 'Agenda inteligente', desc: 'Calendario visual con vista día, semana y mes. Arrastra para reorganizar.' },
  { icon: Bell, title: 'Notificaciones', desc: 'Recordatorios automáticos para tus clientes por WhatsApp o email.' },
  { icon: Palette, title: 'Personalización total', desc: 'Adapta todo a tu rubro: servicios, roles, marca y portal de reservas.' },
  { icon: Users, title: 'Portal de clientes', desc: 'Tus clientes reservan online desde su celular, 24/7.' },
  { icon: Wallet, title: 'Caja y finanzas', desc: 'Control de ingresos, gastos, cierre de caja y medios de pago.' },
  { icon: UserCircle, title: 'Equipo y roles', desc: 'Gestiona tu equipo con roles y permisos personalizados.' },
]

const RUBROS = [
  { icon: Scissors, name: 'Barbería' },
  { icon: Scissors, name: 'Peluquería' },
  { icon: Hand, name: 'Uñas' },
  { icon: Eye, name: 'Lash & Cejas' },
  { icon: Sparkles, name: 'Spa & Estética' },
  { icon: Stethoscope, name: 'Consultorio' },
  { icon: PawPrint, name: 'Veterinaria' },
  { icon: Wrench, name: 'Personalizado' },
]

export default function Landing() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  return (
    <div className={styles.landing}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <span className={styles.logoMark}>T</span>
            <span className={styles.logoText}>TurnosPro</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Funciones</a>
            <a href="#rubros" className={styles.navLink}>Rubros</a>
            <Link href="/login" className="btn btn-primary">Comenzar gratis</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroTag}>Para todo tipo de negocio</div>
          <h1 className={styles.heroTitle}>
            Gestiona tu negocio<br />de forma <span className={styles.heroAccent}>simple</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Turnos, equipo, clientes y finanzas en una sola plataforma.
            Para peluquerías, barberías, spas, consultorios y cualquier emprendimiento.
          </p>
          <div className={styles.heroCTA}>
            <Link href="/login" className="btn btn-primary btn-lg">
              Empezar gratis <ArrowRight size={16} />
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg">Ver más</a>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.mockupCard}>
            <div className={styles.mockupHeader}>
              <div className={styles.mockupDot} />
              <div className={styles.mockupDot} />
              <div className={styles.mockupDot} />
            </div>
            <div className={styles.mockupContent}>
              <div className={styles.mockupStat}>
                <span className={styles.mockupStatLabel}>Turnos hoy</span>
                <span className={styles.mockupStatValue}>12</span>
              </div>
              <div className={styles.mockupStat}>
                <span className={styles.mockupStatLabel}>Ingresos</span>
                <span className={styles.mockupStatValue}>$45,000</span>
              </div>
              <div className={styles.mockupBar} style={{ width: '80%' }} />
              <div className={styles.mockupBar} style={{ width: '60%' }} />
              <div className={styles.mockupBar} style={{ width: '90%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionHeader}>
          <h2>Todo lo que necesitas</h2>
          <p>Herramientas simples y poderosas para gestionar tu negocio.</p>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div key={i} className={`card ${styles.featureCard}`}>
                <div className={styles.featureIcon}>
                  <Icon size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Rubros */}
      <section id="rubros" className={styles.rubros}>
        <div className={styles.sectionHeader}>
          <h2>Para cualquier rubro</h2>
          <p>Un sistema, infinitas posibilidades. Elegí tu rubro y empezá a trabajar.</p>
        </div>
        <div className={styles.rubroGrid}>
          {RUBROS.map((r, i) => {
            const Icon = r.icon
            return (
              <div key={i} className={styles.rubroCard}>
                <Icon size={24} className={styles.rubroIcon} />
                <span className={styles.rubroName}>{r.name}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <h2>Empezá a transformar tu negocio hoy</h2>
        <p>Gratis, sin tarjeta de crédito. Configurá en menos de 2 minutos.</p>
        <Link href="/login" className="btn btn-primary btn-lg">
          Comenzar gratis <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>
            <span className={styles.logoMark}>T</span> TurnosPro
          </span>
          <span className={styles.footerText}>© 2026 TurnosPro. Todos los derechos reservados.</span>
        </div>
      </footer>
    </div>
  )
}
