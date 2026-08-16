import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Phone, Star, Clock, Calendar, ArrowRight } from 'lucide-react'
import JsonLd, { buildLocalBusinessSchema } from '@/components/JsonLd'
import PhotoGallery from '@/components/business/PhotoGallery'
import { minutesToTime, timeToMinutes } from '@/lib/scheduling'
import styles from './profile.module.css'

// La ficha se sirve del servidor para que Google la indexe, pero los datos
// cambian seguido (precios, servicios, reseñas): se revalida cada 5 minutos.
export const revalidate = 300

const TYPE_NAMES = {
    barberia: 'Barbería', peluqueria: 'Peluquería', unas: 'Uñas',
    lash: 'Lash & Cejas', spa: 'Spa & Estética', consultorio: 'Consultorio',
    veterinaria: 'Veterinaria', custom: 'Servicios',
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function createSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}

async function loadProfile(slug) {
    const supabase = createSupabase()

    const { data: business } = await supabase
        .from('businesses')
        .select('id, name, slug, business_type, address, phone, settings, cover_image_url, logo_url, avg_rating, total_reviews')
        .eq('slug', slug)
        .maybeSingle()

    if (!business) return null

    const [{ data: services }, { data: team }, { data: photos }, { data: reviews }] = await Promise.all([
        supabase.from('services')
            .select('id, name, description, duration, price, category')
            .eq('business_id', business.id).eq('active', true)
            .order('sort_order').order('created_at'),
        supabase.from('team_members')
            .select('id, name, role')
            .eq('business_id', business.id).eq('active', true),
        supabase.from('business_photos')
            .select('id, url, alt')
            .eq('business_id', business.id)
            .order('sort_order').order('created_at'),
        supabase.from('reviews')
            .select('id, rating, comment, created_at, profiles:user_id (full_name)')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
            .limit(12),
    ])

    return {
        business,
        services: services || [],
        team: team || [],
        photos: photos || [],
        reviews: reviews || [],
    }
}

export async function generateMetadata({ params }) {
    const { slug } = await params
    const supabase = createSupabase()

    const { data } = await supabase
        .from('businesses')
        .select('name, business_type, address, settings, cover_image_url')
        .eq('slug', slug)
        .maybeSingle()

    if (!data) return { title: 'Negocio no encontrado | GLOWUP' }

    const typeName = TYPE_NAMES[data.business_type] || 'Servicios'
    const description = data.settings?.description
        || `Reservá tu turno en ${data.name}. ${typeName} en ${data.address || 'tu zona'}. Agenda online 24/7.`

    return {
        title: `${data.name} — ${typeName} | Reservar turno`,
        description: description.slice(0, 160),
        openGraph: {
            title: `${data.name} — ${typeName}`,
            description: description.slice(0, 160),
            type: 'website',
            ...(data.cover_image_url && { images: [{ url: data.cover_image_url }] }),
        },
    }
}

/**
 * Agrupa por categoría respetando el orden en que vienen.
 *
 * El campo categoría es texto libre y muchos dueños lo usan como etiqueta del
 * servicio, no como rubro: queda "CORTE" y "CORTE,BARBA", o sea un grupo por
 * servicio con un título que repite el nombre. La agrupación solo se muestra
 * si de verdad organiza algo — al menos un grupo con dos o más servicios.
 */
function groupByCategory(services) {
    const groups = new Map()
    for (const svc of services) {
        const key = svc.category?.trim() || 'Servicios'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(svc)
    }
    const entries = [...groups.entries()]
    const worthGrouping = entries.length > 1 && entries.some(([, list]) => list.length >= 2)
    return worthGrouping ? entries : [['Servicios', services]]
}

function formatPrice(value) {
    if (value === null || value === undefined) return null
    return `$${Number(value).toLocaleString('es-AR')}`
}

export default async function BusinessProfilePage({ params }) {
    const { slug } = await params
    const data = await loadProfile(slug)

    if (!data) notFound()

    const { business, services, team, photos, reviews } = data
    const settings = business.settings || {}
    const typeName = TYPE_NAMES[business.business_type] || 'Servicios'
    const bookUrl = `/book/${business.id}`
    const grouped = groupByCategory(services)

    const workDays = Array.isArray(settings.work_days) && settings.work_days.length
        ? settings.work_days
        : [1, 2, 3, 4, 5, 6]
    const opens = settings.work_hours?.start || '09:00'
    const closes = settings.work_hours?.end || '20:00'

    const rating = Number(business.avg_rating) || 0
    const reviewCount = business.total_reviews || reviews.length

    // El más barato sirve de referencia de precio ("desde $X").
    const cheapest = services.reduce(
        (min, s) => (s.price != null && (min === null || s.price < min) ? s.price : min),
        null
    )

    return (
        <div className={styles.page}>
            <JsonLd data={buildLocalBusinessSchema(business)} />

            {/* ── Portada ── */}
            <header className={styles.hero}>
                {business.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.cover} src={business.cover_image_url} alt={`Portada de ${business.name}`} />
                ) : (
                    <div className={`${styles.cover} ${styles.coverFallback}`} />
                )}
                <div className={styles.heroOverlay} />
            </header>

            <div className={styles.container}>
                {/* ── Identidad ── */}
                <section className={styles.identity}>
                    <div className={styles.avatar}>
                        {business.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={business.logo_url} alt={`Logo de ${business.name}`} />
                        ) : (
                            <span>{business.name?.[0]?.toUpperCase()}</span>
                        )}
                    </div>

                    <div className={styles.identityBody}>
                        <p className={styles.type}>{typeName}</p>
                        <h1 className={styles.name}>{business.name}</h1>

                        <div className={styles.metaRow}>
                            {rating > 0 && (
                                <span className={styles.rating}>
                                    <Star size={14} fill="currentColor" />
                                    <strong>{rating.toFixed(1)}</strong>
                                    <span className={styles.muted}>({reviewCount})</span>
                                </span>
                            )}
                            {business.address && (
                                <a
                                    className={styles.metaLink}
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <MapPin size={14} /> {business.address}
                                </a>
                            )}
                            {business.phone && (
                                <a className={styles.metaLink} href={`tel:${business.phone}`}>
                                    <Phone size={14} /> {business.phone}
                                </a>
                            )}
                        </div>
                    </div>

                    <Link href={bookUrl} className={styles.ctaMain}>
                        <Calendar size={16} /> Reservar turno
                    </Link>
                </section>

                {settings.description && (
                    <p className={styles.about}>{settings.description}</p>
                )}

                {photos.length > 0 && (
                    <section className={styles.section}>
                        <PhotoGallery photos={photos} businessName={business.name} />
                    </section>
                )}

                {/* ── Servicios ── */}
                {services.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <h2>Servicios</h2>
                            {cheapest !== null && (
                                <span className={styles.muted}>desde {formatPrice(cheapest)}</span>
                            )}
                        </div>

                        {grouped.map(([category, list]) => (
                            <div key={category} className={styles.group}>
                                {grouped.length > 1 && <h3 className={styles.groupTitle}>{category}</h3>}
                                <ul className={styles.serviceList}>
                                    {list.map(svc => (
                                        <li key={svc.id} className={styles.serviceRow}>
                                            <div className={styles.serviceInfo}>
                                                <span className={styles.serviceName}>{svc.name}</span>
                                                <span className={styles.serviceMeta}>
                                                    <Clock size={12} /> {svc.duration} min
                                                </span>
                                                {svc.description && (
                                                    <p className={styles.serviceDesc}>{svc.description}</p>
                                                )}
                                            </div>
                                            <div className={styles.serviceAction}>
                                                {svc.price != null && (
                                                    <span className={styles.servicePrice}>{formatPrice(svc.price)}</span>
                                                )}
                                                <Link href={bookUrl} className={styles.ctaSmall}>
                                                    Reservar
                                                </Link>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {/* ── Equipo ── */}
                {team.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionHead}><h2>Equipo</h2></div>
                        <ul className={styles.teamGrid}>
                            {team.map(member => (
                                <li key={member.id} className={styles.teamCard}>
                                    <div className={styles.teamAvatar}>{member.name?.[0]?.toUpperCase()}</div>
                                    <span className={styles.teamName}>{member.name}</span>
                                    {member.role && <span className={styles.muted}>{member.role}</span>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ── Horarios ── */}
                <section className={styles.section}>
                    <div className={styles.sectionHead}><h2>Horarios de atención</h2></div>
                    <ul className={styles.hoursList}>
                        {DAY_NAMES.map((day, index) => {
                            const open = workDays.includes(index)
                            return (
                                <li key={day} className={`${styles.hoursRow} ${open ? '' : styles.hoursClosed}`}>
                                    <span>{day}</span>
                                    <span>
                                        {open
                                            ? `${minutesToTime(timeToMinutes(opens))} – ${minutesToTime(timeToMinutes(closes))}`
                                            : 'Cerrado'}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </section>

                {/* ── Reseñas ── */}
                {reviews.length > 0 && (
                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <h2>Reseñas</h2>
                            {rating > 0 && (
                                <span className={styles.rating}>
                                    <Star size={14} fill="currentColor" />
                                    <strong>{rating.toFixed(1)}</strong>
                                    <span className={styles.muted}>· {reviewCount} opiniones</span>
                                </span>
                            )}
                        </div>
                        <ul className={styles.reviewList}>
                            {reviews.map(review => (
                                <li key={review.id} className={styles.reviewCard}>
                                    <div className={styles.reviewHead}>
                                        <span className={styles.reviewAuthor}>
                                            {review.profiles?.full_name || 'Cliente'}
                                        </span>
                                        <span className={styles.stars} aria-label={`${review.rating} de 5`}>
                                            {Array.from({ length: 5 }, (_, i) => (
                                                <Star
                                                    key={i}
                                                    size={13}
                                                    fill={i < review.rating ? 'currentColor' : 'none'}
                                                    strokeWidth={1.5}
                                                />
                                            ))}
                                        </span>
                                    </div>
                                    {review.comment && <p className={styles.reviewText}>{review.comment}</p>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <Link href={bookUrl} className={styles.ctaBottom}>
                    Reservar turno en {business.name} <ArrowRight size={16} />
                </Link>

                <footer className={styles.footer}>
                    Powered by <Link href="/explore">GLOWUP</Link>
                </footer>
            </div>

            {/* Barra fija en mobile: el CTA de arriba se pierde al scrollear */}
            <Link href={bookUrl} className={styles.stickyCta} aria-label={`Reservar turno en ${business.name}`}>
                <span>
                    {cheapest !== null ? `desde ${formatPrice(cheapest)}` : typeName}
                </span>
                <span className={styles.stickyBtn}>Reservar</span>
            </Link>
        </div>
    )
}
