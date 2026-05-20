'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Icons } from '@/components/Icons';
import Reveal, { useReveal } from '@/components/Reveal';
import Marquee from '@/components/Marquee';
import DarkModeToggle from '@/components/DarkModeToggle';

const CATEGORIES = [
  { key: 'barberia', name: 'Barbería', desc: 'Cortes, barba, color', icon: 'Scissors', tint: 'pink' },
  { key: 'peluqueria', name: 'Peluquería', desc: 'Brushing, balayage, peinados', icon: 'Scissors', tint: 'violet' },
  { key: 'unas', name: 'Uñas', desc: 'Manicura, semi, nail art', icon: 'Hand', tint: 'yellow' },
  { key: 'lash', name: 'Lash & Cejas', desc: 'Extensiones, lifting, diseño', icon: 'Eye', tint: 'mint' },
  { key: 'spa', name: 'Spa & Estética', desc: 'Masajes, faciales, depilación', icon: 'Sparkles', tint: 'pink' },
  { key: 'consultorio', name: 'Consultorio', desc: 'Turnos médicos y kinesio', icon: 'Stethoscope', tint: 'blue' },
  { key: 'veterinaria', name: 'Veterinaria', desc: 'Consultas, vacunas, baño', icon: 'Paw', tint: 'orange' },
  { key: 'custom', name: 'Tu rubro', desc: 'Lo que vendas, lo agendamos', icon: 'Wrench', tint: 'violet' },
];

const FEATURES = [
  { icon: 'Calendar', title: 'Agenda inteligente',  desc: 'Vista día, semana y mes. Reagendá arrastrando.' },
  { icon: 'Bell',     title: 'Recordatorios auto',  desc: 'WhatsApp y mail, sin que toques un botón.' },
  { icon: 'Wallet',   title: 'Caja & finanzas',     desc: 'Ingresos, gastos, cierre y comisiones.' },
  { icon: 'Users',    title: 'Equipo & roles',      desc: 'Permisos finos para cada persona.' },
  { icon: 'Palette',  title: 'Tu marca, tu portal', desc: 'Slug propio, logo, colores. Sin sentirse template.' },
  { icon: 'Shield',   title: 'Sin tarifa por turno', desc: 'Gratis siempre. En serio.' },
];

const MARQUEE_ITEMS = [
  'Barbería',
  'Uñas',
  'Lash',
  'Peluquería',
  'Spa',
  'Veterinaria',
  'Estética',
  'Tu rubro'
];

export default function Landing() {
  const { user } = useAuth();
  useReveal();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      
      {/* NAVBAR */}
      <nav className="gu-nav">
        <div className="gu-nav-inner">
          <Link href="/" className="gu-logo">
            <span className="gu-logo-mark">G</span>
            <span>GLOWUP</span>
          </Link>
          <div className="gu-nav-links">
            <Link className="gu-nav-link gu-nav-hide-sm" href="/explore">Explorar</Link>
            <a className="gu-nav-link gu-nav-hide-sm" href="#business">Para negocios</a>
            <DarkModeToggle />
            {user ? (
              <Link href="/dashboard" className="gu-btn gu-btn-primary gu-btn-sm">
                <span className="gu-nav-hide-sm">Mi </span>Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="gu-nav-link">Ingresar</Link>
                <Link href="/register" className="gu-btn gu-btn-pink gu-btn-sm">
                  Registrar <span className="gu-nav-hide-sm">negocio</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="gu-hero">
        <div className="gu-hero-blob b1"></div>
        <div className="gu-hero-blob b2"></div>
        <div className="gu-hero-blob b3"></div>

        <div className="gu-container gu-hero-inner">
          <div>
            <Reveal as="div" delay={0}>
              <span className="gu-eyebrow">
                <span className="dot"></span>
                Reservás en 30 segundos · sin descargar nada
              </span>
            </Reveal>
            <Reveal as="h1" delay={80}>
              Tu próximo<br/>
              turno se siente <span className="gu-italic">brillante.</span>
            </Reveal>
            <Reveal as="p" delay={160}>
              Encontrá <span style={{ color: 'var(--ink)', fontWeight: 600 }}>barberías, peluquerías, spa, lash, uñas y mucho más</span> cerca tuyo. Mirá disponibilidad en tiempo real y reservá sin llamar a nadie.
            </Reveal>
            <Reveal as="div" delay={240} className="gu-hero-actions">
              <Link href="/explore" className="gu-btn gu-btn-pink gu-btn-lg">
                Buscar mi turno
                <Icons.ArrowRight size={18}/>
              </Link>
              <a href="#business" className="gu-btn gu-btn-ghost gu-btn-lg">
                Tengo un negocio
              </a>
            </Reveal>
            <Reveal as="div" delay={320} className="gu-hero-proof">
              <div className="gu-avatars">
                <span className="gu-av">M</span>
                <span className="gu-av">L</span>
                <span className="gu-av">J</span>
                <span className="gu-av">+</span>
              </div>
              <div className="gu-proof-text">
                <strong>+12.000 personas</strong> ya reservan acá esta semana.
              </div>
            </Reveal>
          </div>

          {/* Phone visual */}
          <Reveal as="div" delay={200} className="gu-hero-visual">
            <div className="gu-sticker s1">
              <Icons.Check size={14} stroke={3}/>
              Confirmado al toque
            </div>
            <div className="gu-sticker s2">
              <span className="gu-emoji-circle" style={{ background: 'var(--mint)', color: 'var(--ink)' }}>
                <Icons.Bell size={11}/>
              </span>
              Te avisamos por WhatsApp
            </div>
            <div className="gu-sticker s3">
              <Icons.Star size={14} solid/>
              4.9 / 5
            </div>

            <div className="gu-phone">
              <div className="gu-phone-screen">
                <div className="gu-phone-statusbar">
                  <span>9:41</span>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ width: 16, height: 8, border: '1px solid currentColor', borderRadius: 2, position: 'relative' }}>
                      <span style={{ position: 'absolute', inset: 1, background: 'currentColor', width: '80%', borderRadius: 1 }}></span>
                    </span>
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Para vos
                  </div>
                  <div className="gu-phone-title">
                    Hola Sofi,<br/>
                    <em>brillá hoy</em>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  <div className="gu-phone-card">
                    <div className="gu-phone-thumb t1">N</div>
                    <div className="gu-phone-info">
                      <span className="gu-phone-name">Nina Studio</span>
                      <span className="gu-phone-meta"><Icons.Star size={10} solid/> 4.9 · Palermo</span>
                    </div>
                    <span className="gu-phone-pill">Hoy 18:30</span>
                  </div>
                  <div className="gu-phone-card">
                    <div className="gu-phone-thumb t2">L</div>
                    <div className="gu-phone-info">
                      <span className="gu-phone-name">Loop Hair Lab</span>
                      <span className="gu-phone-meta"><Icons.Star size={10} solid/> 4.8 · Villa Crespo</span>
                    </div>
                    <span className="gu-phone-pill" style={{ background: 'var(--pink)' }}>Nuevo</span>
                  </div>
                  <div className="gu-phone-card">
                    <div className="gu-phone-thumb t3">B</div>
                    <div className="gu-phone-info">
                      <span className="gu-phone-name">Brisa Spa</span>
                      <span className="gu-phone-meta"><Icons.Star size={10} solid/> 5.0 · Recoleta</span>
                    </div>
                    <span className="gu-phone-pill" style={{ background: 'var(--mint)', color: 'var(--ink)' }}>−20%</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MARQUEE */}
      <Marquee items={MARQUEE_ITEMS} />

      {/* CATEGORIES */}
      <section className="gu-section">
        <div className="gu-container">
          <Reveal className="gu-section-head">
            <h2 className="gu-section-title">
              ¿Qué se te <em>antoja</em><br/>
              hoy?
            </h2>
            <p className="gu-section-sub">
              Más de <strong style={{ color: 'var(--ink)' }}>40 categorías</strong>. Si tu rubro no está, igual lo agendamos. En serio.
            </p>
          </Reveal>

          <div className="gu-cat-grid">
            {CATEGORIES.map((cat, i) => {
              const IconC = Icons[cat.icon] || Icons.Scissors;
              return (
                <Reveal
                  key={cat.key}
                  as={Link}
                  delay={i * 60}
                  className="gu-cat-card"
                  data-tint={cat.tint}
                  href={`/explore?type=${cat.key}`}
                >
                  <div className="gu-cat-icon">
                    <IconC size={26}/>
                  </div>
                  <div className="gu-cat-arrow">
                    <Icons.ArrowRight size={16}/>
                  </div>
                  <div className="gu-cat-bottom">
                    <span className="gu-cat-name">{cat.name}</span>
                    <span className="gu-cat-desc">{cat.desc}</span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="gu-section gu-section-dark">
        <div className="gu-container">
          <Reveal className="gu-section-head">
            <h2 className="gu-section-title">
              Tres pasos<br/>
              y <em>listo</em>.
            </h2>
            <p className="gu-section-sub">
              Sin llamadas. Sin esperar respuesta. Sin pelearte con un Instagram.
            </p>
          </Reveal>
          <div className="gu-steps">
            <Reveal className="gu-step" delay={0}>
              <div className="gu-step-num">01</div>
              <h3>Buscá</h3>
              <p>Filtrá por rubro, barrio, precio o disponibilidad. Vas a ver fotos reales y reseñas reales.</p>
            </Reveal>
            <Reveal className="gu-step" delay={120}>
              <div className="gu-step-num">02</div>
              <h3>Elegí</h3>
              <p>Mirá el calendario del lugar en vivo. Tocá el día y horario que te queden cómodos.</p>
            </Reveal>
            <Reveal className="gu-step" delay={240}>
              <div className="gu-step-num">03</div>
              <h3>Brillá</h3>
              <p>Te llega recordatorio por WhatsApp. Llegás y disfrutás. Después dejás reseña si querés.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* BUSINESS PITCH */}
      <section className="gu-section gu-biz" id="business">
        <div className="gu-container">
          <div className="gu-biz-grid">
            <div>
              <Reveal>
                <span className="gu-eyebrow">
                  <span className="dot" style={{ background: 'var(--pink)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--pink) 30%, transparent)' }}></span> 
                  Para negocios
                </span>
              </Reveal>
              <Reveal as="h2" className="gu-section-title" delay={80} style={{ marginTop: 16 }}>
                Llená tu agenda<br/>
                <em>sin levantar el teléfono.</em>
              </Reveal>
              <Reveal as="p" className="gu-section-sub" delay={160} style={{ marginTop: 16, fontSize: 17, maxWidth: 480 }}>
                Tus clientes reservan online 24/7, vos cobrás. Nosotros nos encargamos del resto. Sin tarjeta de crédito para empezar.
              </Reveal>

              <Reveal as="div" delay={220} className="gu-feature-list">
                {FEATURES.map((f) => {
                  const IconC = Icons[f.icon] || Icons.Zap;
                  return (
                    <div key={f.title} className="gu-feature">
                      <div className="gu-feature-icon"><IconC size={22}/></div>
                      <div>
                        <h4>{f.title}</h4>
                        <p>{f.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </Reveal>

              <Reveal delay={360} style={{ marginTop: 32 }}>
                <Link href={user ? "/dashboard" : "/register"} className="gu-btn gu-btn-primary gu-btn-lg">
                  {user ? "Ir a mi Dashboard" : "Crear mi negocio gratis"}
                  <Icons.ArrowRight size={18}/>
                </Link>
              </Reveal>
            </div>

            <Reveal delay={120}>
              <div className="gu-dash-card">
                <div className="gu-dash-head">
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Agenda · Hoy
                    </div>
                    <div className="gu-dash-title">Martes 19 de mayo</div>
                  </div>
                  <button className="gu-btn gu-btn-pink gu-btn-sm" type="button">
                    <Icons.Plus size={14}/> Nuevo
                  </button>
                </div>

                <div className="gu-dash-day">
                  {['L','M','M','J','V','S','D'].map((d, i) => (
                    <div key={i} className={`gu-dash-dow ${i === 1 ? 'active' : ''}`}>
                      {d}<span>{i+18}</span>
                    </div>
                  ))}
                </div>

                <div className="gu-dash-list">
                  {[
                    { time: '09:30', bar: '', name: 'María González', service: 'Color + brushing · 90 min' },
                    { time: '11:00', bar: 'v', name: 'Julia Pérez',     service: 'Manicura semi · 45 min' },
                    { time: '14:00', bar: 'y', name: 'Federico Rey',    service: 'Corte + barba · 50 min' },
                    { time: '15:30', bar: 'm', name: 'Camila S.',       service: 'Lash lift · 60 min' },
                  ].map((appt, i) => (
                    <div key={i} className="gu-dash-item">
                      <span className="gu-dash-time">{appt.time}</span>
                      <span className={`gu-dash-bar ${appt.bar}`}></span>
                      <div className="gu-dash-info">
                        <b>{appt.name}</b>
                        <small>{appt.service}</small>
                      </div>
                      <span className="gu-dash-status">
                        <Icons.Check size={11} stroke={3}/>
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '12px 0 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Total del día</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>$ 78.500</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="gu-footer">
        <div className="gu-container">
          <div className="gu-footer-big">GLOW<em style={{ fontStyle: 'italic', color: 'var(--pink)', WebkitTextStroke: 0 }}>UP</em></div>
          <div className="gu-footer-grid">
            <div>
              <div className="gu-logo" style={{ marginBottom: 12 }}>
                <span className="gu-logo-mark">G</span>
                <span>GLOWUP</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', maxWidth: 260, lineHeight: 1.5 }}>
                Reservas online para todos los que cuidan personas, pelos, uñas, mascotas y todo lo demás.
              </p>
            </div>
            <div>
              <h5>Producto</h5>
              <div className="gu-footer-links">
                <Link href="/explore">Explorar negocios</Link>
                <Link href="/explore">Categorías</Link>
                <Link href="/explore">Mis turnos</Link>
              </div>
            </div>
            <div>
              <h5>Negocios</h5>
              <div className="gu-footer-links">
                <Link href={user ? "/dashboard" : "/register"}>Registrar mi negocio</Link>
                <Link href="/#business">Funcionalidades</Link>
                <Link href="/register">Precios</Link>
              </div>
            </div>
            <div>
              <h5>Empresa</h5>
              <div className="gu-footer-links">
                <a href="#" onClick={(e) => e.preventDefault()}>Sobre nosotros</a>
                <a href="#" onClick={(e) => e.preventDefault()}>Privacidad</a>
                <a href="#" onClick={(e) => e.preventDefault()}>Términos</a>
              </div>
            </div>
          </div>
          <div className="gu-footer-bot">
            <span>© 2026 GLOWUP · Hecho con ♥ en Argentina</span>
            <span style={{ display: 'inline-flex', gap: 12 }}>
              <a href="#" aria-label="Instagram" style={{ color: 'var(--ink-mute)' }}><Icons.Instagram size={20}/></a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
