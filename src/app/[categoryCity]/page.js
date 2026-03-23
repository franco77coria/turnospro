import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { MapPin, Star, ArrowRight } from 'lucide-react'

const CATEGORIES = {
    barberias: { type: 'barberia', name: 'Barberías', singular: 'barbería' },
    peluquerias: { type: 'peluqueria', name: 'Peluquerías', singular: 'peluquería' },
    unas: { type: 'unas', name: 'Salones de Uñas', singular: 'salón de uñas' },
    lash: { type: 'lash', name: 'Lash & Cejas', singular: 'centro de lash' },
    spas: { type: 'spa', name: 'Spas', singular: 'spa' },
    consultorios: { type: 'consultorio', name: 'Consultorios', singular: 'consultorio' },
    veterinarias: { type: 'veterinaria', name: 'Veterinarias', singular: 'veterinaria' },
}

const CITIES = [
    'bogota', 'medellin', 'cali', 'barranquilla', 'cartagena', 'bucaramanga',
    'buenos-aires', 'cordoba', 'rosario', 'mendoza', 'tucuman', 'la-plata',
    'lima', 'santiago', 'mexico-city', 'guadalajara', 'monterrey',
]

const CITY_NAMES = {
    'bogota': 'Bogotá', 'medellin': 'Medellín', 'cali': 'Cali',
    'barranquilla': 'Barranquilla', 'cartagena': 'Cartagena', 'bucaramanga': 'Bucaramanga',
    'buenos-aires': 'Buenos Aires', 'cordoba': 'Córdoba', 'rosario': 'Rosario',
    'mendoza': 'Mendoza', 'tucuman': 'Tucumán', 'la-plata': 'La Plata',
    'lima': 'Lima', 'santiago': 'Santiago', 'mexico-city': 'Ciudad de México',
    'guadalajara': 'Guadalajara', 'monterrey': 'Monterrey',
}

function parseCategoryCity(slug) {
    // Pattern: "barberias-en-bogota"
    const match = slug.match(/^(.+)-en-(.+)$/)
    if (!match) return null

    const [, catSlug, citySlug] = match
    const category = CATEGORIES[catSlug]
    const cityName = CITY_NAMES[citySlug]

    if (!category || !cityName) return null
    return { category, citySlug, cityName }
}

export async function generateStaticParams() {
    const params = []
    for (const catKey of Object.keys(CATEGORIES)) {
        for (const city of CITIES) {
            params.push({ categoryCity: `${catKey}-en-${city}` })
        }
    }
    return params
}

export async function generateMetadata({ params }) {
    const { categoryCity } = await params
    const parsed = parseCategoryCity(categoryCity)
    if (!parsed) return { title: 'Página no encontrada' }

    const { category, cityName } = parsed
    const title = `${category.name} en ${cityName} - Reservá online | GLOWUP`
    const description = `Encontrá las mejores ${category.name.toLowerCase()} en ${cityName}. Reservá tu turno online en segundos. Sin llamar, sin esperar.`

    return {
        title,
        description,
        openGraph: { title, description, type: 'website' },
    }
}

async function getBusinesses(businessType, city) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        const { data } = await supabase
            .from('businesses')
            .select('id, name, slug, address, cover_image_url, avg_rating, total_reviews')
            .eq('business_type', businessType)
            .ilike('address', `%${city}%`)
            .order('avg_rating', { ascending: false })
            .limit(50)
        return data || []
    } catch {
        return []
    }
}

export default async function CityCategoryPage({ params }) {
    const { categoryCity } = await params
    const parsed = parseCategoryCity(categoryCity)

    if (!parsed) {
        return (
            <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                <h1>Página no encontrada</h1>
                <Link href="/explore">Explorar negocios</Link>
            </div>
        )
    }

    const { category, cityName, citySlug } = parsed
    const businesses = await getBusinesses(category.type, CITY_NAMES[citySlug])

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
            <nav style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                <Link href="/" style={{ color: '#6366F1' }}>Inicio</Link>
                {' > '}
                <Link href="/explore" style={{ color: '#6366F1' }}>Explorar</Link>
                {' > '}
                <Link href={`/explore/${category.type}`} style={{ color: '#6366F1' }}>{category.name}</Link>
                {' > '}
                <span>{cityName}</span>
            </nav>

            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {category.name} en {cityName}
            </h1>
            <p style={{ color: '#6B7280', marginBottom: '2rem', maxWidth: 600 }}>
                Encontrá y reservá en las mejores {category.name.toLowerCase()} de {cityName}.
                Agenda online disponible 24/7, sin necesidad de llamar.
            </p>

            {businesses.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {businesses.map(biz => (
                        <Link
                            key={biz.id}
                            href={biz.slug ? `/book/s/${biz.slug}` : `/book/${biz.id}`}
                            style={{
                                display: 'block', borderRadius: 12, overflow: 'hidden',
                                border: '1px solid #E5E7EB', textDecoration: 'none', color: 'inherit',
                                transition: 'box-shadow 0.2s',
                            }}
                        >
                            <div style={{
                                height: 160, background: biz.cover_image_url
                                    ? `url(${biz.cover_image_url}) center/cover`
                                    : 'linear-gradient(135deg, #6366F1, #818CF8)',
                                display: 'flex', alignItems: 'flex-end', padding: '1rem',
                            }}>
                                {!biz.cover_image_url && (
                                    <span style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                        {biz.name?.[0]}
                                    </span>
                                )}
                            </div>
                            <div style={{ padding: '1rem' }}>
                                <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{biz.name}</h3>
                                {biz.address && (
                                    <p style={{ fontSize: '0.875rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <MapPin size={14} /> {biz.address}
                                    </p>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.5rem' }}>
                                    {biz.avg_rating > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem' }}>
                                            <Star size={14} fill="#F59E0B" stroke="#F59E0B" />
                                            {biz.avg_rating} ({biz.total_reviews})
                                        </span>
                                    )}
                                    <span style={{ marginLeft: 'auto', color: '#6366F1', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        Reservar <ArrowRight size={14} />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#F9FAFB', borderRadius: 12 }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>Aún no hay {category.name.toLowerCase()} en {cityName}</h3>
                    <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
                        Sé el primero en registrar tu {category.singular} en GLOWUP.
                    </p>
                    <Link href="/register" style={{
                        display: 'inline-block', padding: '0.75rem 1.5rem', background: '#4F46E5',
                        color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600,
                    }}>
                        Registrar mi negocio
                    </Link>
                </div>
            )}

            {/* SEO content */}
            <section style={{ marginTop: '3rem', padding: '2rem', background: '#F9FAFB', borderRadius: 12 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                    Reservá en {category.name.toLowerCase()} de {cityName} con GLOWUP
                </h2>
                <p style={{ color: '#374151', lineHeight: 1.7 }}>
                    GLOWUP te permite encontrar y reservar en las mejores {category.name.toLowerCase()} de {cityName} sin llamar
                    ni esperar. Elegí el servicio que necesitás, seleccioná el profesional y el horario que te quede mejor,
                    y confirmá tu turno en segundos. Recibí recordatorios automáticos para que nunca te olvides de tu cita.
                </p>
            </section>

            {/* Related cities */}
            <section style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    {category.name} en otras ciudades
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {CITIES.filter(c => c !== citySlug).slice(0, 8).map(city => (
                        <Link
                            key={city}
                            href={`/${Object.keys(CATEGORIES).find(k => CATEGORIES[k].type === category.type)}-en-${city}`}
                            style={{
                                padding: '0.5rem 1rem', background: 'white', border: '1px solid #E5E7EB',
                                borderRadius: 8, fontSize: '0.875rem', color: '#374151', textDecoration: 'none',
                            }}
                        >
                            {CITY_NAMES[city]}
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    )
}
