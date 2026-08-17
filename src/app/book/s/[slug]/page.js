import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Phone, Star, Clock, ArrowRight, MessageCircle } from 'lucide-react'
import JsonLd, { buildLocalBusinessSchema } from '@/components/JsonLd'
import PhotoGallery from '@/components/business/PhotoGallery'
import SocialLinks from '@/components/business/SocialLinks'
import { DEFAULT_DURATION, formatDateLocal, minutesToTime, timeToMinutes, toOccupiedRanges } from '@/lib/scheduling'
import { nowInTimezone } from '@/lib/timezone'
import {
    buildMapQuery,
    buildOpeningHoursSpecification,
    buildWhatsAppLink,
    collapseWeeklyHours,
    hasConfiguredHours,
    resolveOpenStatus,
    resolveTenure,
    resolveTodayAvailability,
} from '@/lib/business-profile'
import { resolveSocialLinks } from '@/lib/socials'
import styles from './profile.module.css'

// La ficha muestra disponibilidad de hoy, así que no puede quedar muy vieja.
// Además, el dueño que edita un precio quiere verlo enseguida.
export const revalidate = 60

const TYPE_NAMES = {
    barberia: 'Barbería', peluqueria: 'Peluquería', unas: 'Estudio de uñas',
    lash: 'Estudio de lashes y cejas', spa: 'Spa', consultorio: 'Consultorio',
    veterinaria: 'Veterinaria', custom: 'Servicios',
}

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
        .select('id, name, slug, business_type, address, phone, settings, cover_image_url, logo_url, avg_rating, total_reviews, created_at')
        .eq('slug', slug)
        .maybeSingle()

    if (!business) return null

    const today = formatDateLocal(nowInTimezone())

    const [{ data: services }, { data: team }, { data: photos }, { data: reviews }, { data: busy }] = await Promise.all([
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
        // Agenda de hoy, para poder decir cuántos turnos quedan libres.
        supabase.from('public_busy_slots')
            .select('time, duration, team_member_id')
            .eq('business_id', business.id)
            .eq('date', today),
    ])

    return {
        business,
        services: services || [],
        team: team || [],
        photos: photos || [],
        reviews: reviews || [],
        busy: busy || [],
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

    const name = data.name?.trim() || 'Negocio'
    const typeName = TYPE_NAMES[data.business_type] || 'Servicios'
    const description = data.settings?.description
        || `Reservá tu turno en ${name}. ${typeName} en ${data.address || 'tu zona'}. Agenda online 24/7.`

    return {
        title: `${name} — ${typeName} | Reservar turno`,
        description: description.slice(0, 160),
        openGraph: {
            title: `${name} — ${typeName}`,
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

    const { business, services, team, photos, reviews, busy } = data
    const settings = business.settings || {}
    // El nombre viene del dueño y puede traer espacios: fluía sin limpiar al
    // <title>, al <h1> y al texto de los botones.
    const name = business.name?.trim() || 'Negocio'
    const typeName = TYPE_NAMES[business.business_type] || 'Servicios'
    const bookUrl = `/book/${business.id}`
    const grouped = groupByCategory(services)

    const shortestService = services.reduce(
        (min, s) => (min === null || s.duration < min ? s.duration : min),
        null
    )
    const cheapest = services.reduce(
        (min, s) => (s.price != null && (min === null || s.price < min) ? s.price : min),
        null
    )

    const status = resolveOpenStatus(settings)
    const availability = resolveTodayAvailability({
        settings,
        occupied: toOccupiedRanges(busy),
        duration: shortestService || DEFAULT_DURATION,
    })
    const tenure = resolveTenure(business.created_at)
    const weeklyHours = collapseWeeklyHours(settings)

    const socials = resolveSocialLinks(settings)
    const mapQuery = buildMapQuery(business.address)

    const whatsapp = buildWhatsAppLink(
        business.phone,
        `Hola ${name}! Te escribo desde tu página de GLOWUP.`
    )

    const rating = Number(business.avg_rating) || 0
    // Un rating sin reseñas mostraba "4.5 (0)" mientras la sección quedaba oculta.
    const reviewCount = business.total_reviews || reviews.length
    const showRating = rating > 0 && reviewCount > 0

    const schema = {
        ...buildLocalBusinessSchema({ ...business, name }),
        ...(buildOpeningHoursSpecification(settings) && {
            openingHoursSpecification: buildOpeningHoursSpecification(settings),
        }),
        // priceRange salía fijo en '$$' aunque los precios reales se conozcan.
        ...(cheapest !== null && { priceRange: `${formatPrice(cheapest)}+` }),
        // sameAs enlaza el negocio con sus perfiles reales: Google usa esto
        // para confirmar que la ficha y las redes son la misma entidad.
        ...(socials.length > 0 && { sameAs: socials.map(s => s.url) }),
        ...(business.address && {
            address: {
                '@type': 'PostalAddress',
                streetAddress: business.address,
                // Sin país el PostalAddress no es válido para Google. El
                // producto es solo Argentina (timezone fija en lib/timezone.js).
                addressCountry: 'AR',
            },
        }),
    }

    return (
        <div className={styles.page}>
            <JsonLd data={schema} />

            <main className={styles.container}>
                {/* ── Presentación ── */}
                <header className={`${styles.intro} ${business.cover_image_url ? styles.introWithCover : ''}`}>
                    <div className={styles.introBody}>
                        <h1 className={styles.name}>{name}</h1>

                        {/* El rubro va en una frase, no en una etiqueta flotante */}
                        <p className={styles.lede}>
                            {typeName}
                            {business.address && <> en {business.address}</>}
                        </p>

                        {settings.description && (
                            <blockquote className={styles.quote}>
                                {settings.description}
                            </blockquote>
                        )}

                        {/* Estado real, no una tabla que hay que interpretar */}
                        {(status || availability?.nextSlot || cheapest !== null) && (
                            <p className={styles.status}>
                                {status && (
                                    <span className={status.open ? styles.dotOpen : styles.dotClosed} />
                                )}
                                {[
                                    status?.label,
                                    availability?.nextSlot && `próximo turno hoy ${availability.nextSlot}`,
                                    cheapest !== null && `desde ${formatPrice(cheapest)}`,
                                ].filter(Boolean).join(' · ')}
                            </p>
                        )}

                        <div className={styles.actions}>
                            <Link href={bookUrl} className={styles.ctaMain}>
                                Reservar turno <ArrowRight size={16} />
                            </Link>
                            {whatsapp && (
                                <a
                                    className={styles.ctaGhost}
                                    href={whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <MessageCircle size={16} /> Escribir por WhatsApp
                                </a>
                            )}
                        </div>

                        <p className={styles.reassure}>
                            Gratis, sin tarjeta y cancelás cuando quieras.
                            {tenure && <> Reservando online desde {tenure}.</>}
                        </p>
                    </div>

                    {business.cover_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.cover} src={business.cover_image_url} alt={`Local de ${name}`} />
                    )}
                </header>

                {photos.length > 0 && (
                    <section className={styles.section} aria-labelledby="fotos">
                        <h2 id="fotos" className={styles.srOnly}>Fotos</h2>
                        <PhotoGallery photos={photos} businessName={name} />
                    </section>
                )}

                {/* ── Servicios ── */}
                {services.length > 0 && (
                    <section className={styles.section} aria-labelledby="servicios">
                        <h2 id="servicios" className={styles.sectionTitle}>Servicios</h2>

                        {grouped.map(([category, list]) => (
                            <div key={category} className={styles.group}>
                                {grouped.length > 1 && <h3 className={styles.groupTitle}>{category}</h3>}
                                <ul className={styles.serviceList}>
                                    {list.map(svc => (
                                        <li key={svc.id}>
                                            {/* La fila entera es el link, y lleva el servicio elegido
                                                al wizard: antes se descartaba y había que elegirlo de nuevo. */}
                                            <Link href={`${bookUrl}?service=${svc.id}`} className={styles.serviceRow}>
                                                <span className={styles.serviceInfo}>
                                                    <span className={styles.serviceName}>{svc.name}</span>
                                                    <span className={styles.serviceMeta}>
                                                        <Clock size={12} /> {svc.duration} min
                                                    </span>
                                                    {svc.description && (
                                                        <span className={styles.serviceDesc}>{svc.description}</span>
                                                    )}
                                                </span>
                                                <span className={styles.serviceAction}>
                                                    {svc.price != null && (
                                                        <span className={styles.servicePrice}>{formatPrice(svc.price)}</span>
                                                    )}
                                                    <span className={styles.serviceGo} aria-hidden="true">
                                                        <ArrowRight size={16} />
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </section>
                )}

                {/* ── Equipo ── */}
                {team.length > 0 && (
                    <section className={styles.section} aria-labelledby="equipo">
                        <h2 id="equipo" className={styles.sectionTitle}>Equipo</h2>
                        <ul className={styles.teamGrid}>
                            {team.map(member => (
                                <li key={member.id} className={styles.teamCard}>
                                    <span className={styles.teamAvatar}>{member.name?.trim()?.[0]?.toUpperCase() || '·'}</span>
                                    <span className={styles.teamName}>{member.name}</span>
                                    {member.role && <span className={styles.muted}>{member.role}</span>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ── Horarios ── */}
                <section className={styles.section} aria-labelledby="horarios">
                    <h2 id="horarios" className={styles.sectionTitle}>Horarios</h2>
                    {weeklyHours.length > 0 ? (
                        <ul className={styles.hoursList}>
                            {weeklyHours.map(row => (
                                <li key={row.label} className={`${styles.hoursRow} ${row.hours ? '' : styles.hoursClosed}`}>
                                    <span>{row.label}</span>
                                    <span>{row.hours || 'Cerrado'}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        // Sin horario configurado NO se inventa uno: antes se publicaba
                        // "09:00 – 20:00, lunes a sábado" como si fuera un hecho.
                        <p className={styles.emptyNote}>
                            Este negocio todavía no publicó sus horarios. Mirá los turnos libres al reservar.
                        </p>
                    )}
                </section>

                {/* ── Reseñas ── */}
                {reviews.length > 0 && (
                    <section className={styles.section} aria-labelledby="resenas">
                        <div className={styles.sectionHead}>
                            <h2 id="resenas" className={styles.sectionTitle}>Reseñas</h2>
                            {showRating && (
                                <span className={styles.rating}>
                                    <Star size={15} fill="currentColor" strokeWidth={0} />
                                    <strong>{rating.toFixed(1)}</strong>
                                    <span className={styles.muted}>· {reviewCount}</span>
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
                                                <Star key={i} size={13} fill={i < review.rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
                                            ))}
                                        </span>
                                    </div>
                                    {review.comment && <p className={styles.reviewText}>{review.comment}</p>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ── Dónde queda ── */}
                <section className={styles.section} aria-labelledby="contacto">
                    <h2 id="contacto" className={styles.sectionTitle}>Dónde queda</h2>

                    {business.address && (
                        <div className={styles.mapFrame}>
                            {/* Embed sin API key. El CSP habilita solo este origen.
                                loading="lazy" evita pagar el mapa en el primer render. */}
                            <iframe
                                title={`Mapa de ${name}`}
                                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&hl=es`}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                allowFullScreen
                            />
                        </div>
                    )}

                    <div className={styles.contactRow}>
                        {business.address && (
                            <a
                                className={styles.contactLink}
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <MapPin size={16} /> {business.address}
                                <span className={styles.muted}>Cómo llegar</span>
                            </a>
                        )}
                        {business.phone && (
                            <a className={styles.contactLink} href={`tel:${business.phone}`}>
                                <Phone size={16} /> {business.phone}
                            </a>
                        )}
                    </div>

                    {socials.length > 0 && (
                        <div className={styles.socials}>
                            <SocialLinks links={socials} businessName={name} />
                        </div>
                    )}
                </section>

                <Link href={bookUrl} className={styles.ctaBottom}>
                    Reservar en {name} <ArrowRight size={18} />
                </Link>

                <footer className={styles.footer}>
                    Powered by <Link href="/explore">GLOWUP</Link>
                </footer>
            </main>

            {/* Barra fija en mobile: el CTA de arriba se pierde al scrollear */}
            <Link href={bookUrl} className={styles.stickyCta} aria-label={`Reservar turno en ${name}`}>
                <span className={styles.stickyInfo}>
                    {availability?.nextSlot
                        ? `Próximo turno hoy ${availability.nextSlot}`
                        : cheapest !== null ? `Desde ${formatPrice(cheapest)}` : 'Agenda online'}
                </span>
                <span className={styles.stickyBtn}>Reservar</span>
            </Link>
        </div>
    )
}
