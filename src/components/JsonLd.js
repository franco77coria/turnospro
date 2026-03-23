/**
 * JSON-LD structured data component for SEO.
 * Renders a <script type="application/ld+json"> tag.
 */
export default function JsonLd({ data }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    )
}

/**
 * Generate LocalBusiness schema for a business page
 */
export function buildLocalBusinessSchema(business) {
    const typeMap = {
        barberia: 'BarberShop',
        peluqueria: 'HairSalon',
        unas: 'NailSalon',
        spa: 'DaySpa',
        lash: 'BeautySalon',
        consultorio: 'MedicalBusiness',
        veterinaria: 'VeterinaryCare',
    }

    return {
        '@context': 'https://schema.org',
        '@type': typeMap[business.business_type] || 'LocalBusiness',
        name: business.name,
        ...(business.address && { address: { '@type': 'PostalAddress', streetAddress: business.address } }),
        ...(business.phone && { telephone: business.phone }),
        ...(business.slug && {
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://glowup.com.ar'}/book/s/${business.slug}`,
        }),
        ...(business.avg_rating > 0 && {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: business.avg_rating,
                reviewCount: business.review_count || business.total_reviews || 1,
            },
        }),
        ...(business.cover_image_url && { image: business.cover_image_url }),
        priceRange: '$$',
    }
}

/**
 * Generate WebSite schema for the homepage
 */
export function buildWebSiteSchema() {
    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://glowup.com.ar'
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'GLOWUP',
        url,
        potentialAction: {
            '@type': 'SearchAction',
            target: `${url}/explore?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
        },
    }
}
