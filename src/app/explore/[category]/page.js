import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Star, Clock } from 'lucide-react'

const CATEGORY_META = {
    barberia: { name: 'Barberías', desc: 'Los mejores barberos cerca tuyo. Reservá tu corte, barba y más.' },
    peluqueria: { name: 'Peluquerías', desc: 'Encontrá tu peluquera ideal. Corte, color, brushing y tratamientos.' },
    unas: { name: 'Uñas y Nail Art', desc: 'Manicura, pedicura y nail art profesional. Reservá online.' },
    lash: { name: 'Pestañas y Cejas', desc: 'Extensiones, lifting de pestañas y diseño de cejas.' },
    spa: { name: 'Spas y Estética', desc: 'Masajes, tratamientos faciales, y más. Relajate con GLOWUP.' },
    consultorio: { name: 'Consultorios', desc: 'Turnos médicos online. Consultas rápidas y sin esperas.' },
    veterinaria: { name: 'Veterinarias', desc: 'Turnos para tu mascota. Consultas, vacunas y baño.' },
    custom: { name: 'Otros servicios', desc: 'Emprendimientos de todo tipo con reservas online.' },
}

export async function generateStaticParams() {
    return Object.keys(CATEGORY_META).map(category => ({ category }))
}

export async function generateMetadata({ params }) {
    const { category } = await params
    const cat = CATEGORY_META[category]
    if (!cat) return { title: 'Categoría no encontrada' }

    return {
        title: `${cat.name} — Reservá online`,
        description: cat.desc,
        openGraph: {
            title: `${cat.name} en GLOWUP`,
            description: cat.desc,
        },
    }
}

async function getBusinessesByCategory(category) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        const { data } = await supabase
            .from('businesses')
            .select('id, name, slug, address, business_type, cover_image_url, avg_rating, total_reviews')
            .eq('business_type', category)
            .order('avg_rating', { ascending: false })
            .limit(50)
        return data || []
    } catch {
        return []
    }
}

export default async function CategoryPage({ params }) {
    const { category } = await params
    const cat = CATEGORY_META[category]

    if (!cat) {
        return (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <h1>Categoría no encontrada</h1>
                <Link href="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    Explorar todas
                </Link>
            </div>
        )
    }

    const businesses = await getBusinessesByCategory(category)

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <Link href="/explore" style={{ color: 'var(--accent)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    ← Volver a Explorar
                </Link>
            </div>
            <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>
                {cat.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-8)' }}>
                {cat.desc}
            </p>

            {businesses.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Todavía no hay negocios en esta categoría. ¡Sé el primero!
                    </p>
                    <Link href="/register" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
                        Registrar mi negocio
                    </Link>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    {businesses.map(biz => (
                        <Link
                            key={biz.id}
                            href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                            className="card"
                            style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', textDecoration: 'none', transition: 'box-shadow 0.15s ease' }}
                        >
                            <div style={{
                                width: 64, height: 64, borderRadius: 'var(--radius-lg)',
                                background: biz.cover_image_url ? `url(${biz.cover_image_url}) center/cover` : 'var(--accent-light)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--accent)', fontWeight: 700, fontSize: 'var(--font-size-xl)', flexShrink: 0,
                            }}>
                                {!biz.cover_image_url && biz.name?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>{biz.name}</h3>
                                {biz.address && (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={12} /> {biz.address}
                                    </p>
                                )}
                            </div>
                            {biz.avg_rating > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B', fontWeight: 600, fontSize: 'var(--font-size-sm)', flexShrink: 0 }}>
                                    <Star size={14} fill="#F59E0B" />
                                    {Number(biz.avg_rating).toFixed(1)}
                                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({biz.total_reviews})</span>
                                </div>
                            )}
                        </Link>
                    ))}
                </div>
            )}

            {/* Structured data for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        name: cat.name,
                        description: cat.desc,
                        numberOfItems: businesses.length,
                        itemListElement: businesses.map((biz, i) => ({
                            '@type': 'ListItem',
                            position: i + 1,
                            item: {
                                '@type': 'LocalBusiness',
                                name: biz.name,
                                address: biz.address || undefined,
                                aggregateRating: biz.avg_rating > 0 ? {
                                    '@type': 'AggregateRating',
                                    ratingValue: biz.avg_rating,
                                    reviewCount: biz.total_reviews,
                                } : undefined,
                            },
                        })),
                    }),
                }}
            />
        </div>
    )
}
