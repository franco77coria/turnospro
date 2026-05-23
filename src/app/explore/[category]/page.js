import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Star, ChevronLeft } from 'lucide-react'
import ConsumerLayout from '@/components/layout/ConsumerLayout'
import JsonLd from '@/components/JsonLd'

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
            <ConsumerLayout>
                <div style={{ padding: '80px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--ink)' }}>Categoría no encontrada</h1>
                    <Link href="/explore" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
                        Explorar todas
                    </Link>
                </div>
            </ConsumerLayout>
        )
    }

    const businesses = await getBusinessesByCategory(category)

    return (
        <ConsumerLayout>
            <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 16px 80px', animation: 'reveal-y 0.6s var(--e-out) forwards' }}>
                <div style={{ marginBottom: 24 }}>
                    <Link href="/explore" style={{ color: 'var(--pink)', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ChevronLeft size={14} /> Volver a Explorar
                    </Link>
                </div>
                
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 8 }}>
                    {cat.name}
                </h1>
                
                <p style={{ color: 'var(--ink-soft)', fontSize: 15, fontWeight: 500, marginBottom: 32 }}>
                    {cat.desc}
                </p>

                {businesses.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '64px 24px', background: 'var(--bg-card)', 
                        borderRadius: 'var(--r-xl)', border: '1px dashed var(--line)'
                    }}>
                        <p style={{ color: 'var(--ink-soft)', fontWeight: 500, fontSize: 14, marginBottom: 16 }}>
                            Todavía no hay negocios registrados en esta categoría.
                        </p>
                        <Link href="/register" className="btn btn-primary">
                            Registrar mi negocio
                        </Link>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {businesses.map(biz => (
                            <Link
                                key={biz.id}
                                href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                                style={{
                                    display: 'flex', gap: 16, alignItems: 'center', textDecoration: 'none', 
                                    background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--r-xl)',
                                    border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)',
                                    transition: 'all var(--t-fast)'
                                }}
                                className="category-biz-card"
                            >
                                <div style={{
                                    width: 64, height: 64, borderRadius: 'var(--r-lg)',
                                    background: biz.cover_image_url ? `url(${biz.cover_image_url}) center/cover` : 'linear-gradient(135deg, var(--pink), var(--violet))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 800, fontSize: 20, flexShrink: 0,
                                    boxShadow: '0 4px 10px color-mix(in oklab, var(--pink) 15%, transparent)'
                                }}>
                                    {!biz.cover_image_url && biz.name?.[0]?.toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{biz.name}</h3>
                                    {biz.address && (
                                        <p style={{ color: 'var(--ink-soft)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, margin: '4px 0 0' }}>
                                            <MapPin size={12} /> {biz.address}
                                        </p>
                                    )}
                                </div>
                                {biz.avg_rating > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                                        <Star size={14} fill="#F59E0B" color="#F59E0B" />
                                        {Number(biz.avg_rating).toFixed(1)}
                                        <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>({biz.total_reviews})</span>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Structured data for SEO — uses JsonLd helper which escapes `<` to prevent </script> break-out */}
                <JsonLd data={{
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
                }} />
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .category-biz-card:hover {
                    border-color: var(--pink) !important;
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md) !important;
                }
            `}} />
        </ConsumerLayout>
    )
}

