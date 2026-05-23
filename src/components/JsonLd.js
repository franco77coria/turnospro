/**
 * JSON-LD structured data component for SEO.
 * Renders a <script type="application/ld+json"> tag.
 *
 * The serialized payload escapes `<` so a malicious value containing
 * `</script>` (e.g. injected via a user-editable business name) cannot
 * break out of the script tag and execute arbitrary JS. We also escape
 * U+2028 / U+2029 because some older parsers treated them as line
 * terminators inside string literals.
 */

// Build the line-separator regex at runtime so the source file contains no
// raw U+2028/U+2029 characters (which break some lint parsers).
const LINE_SEP_REGEX = new RegExp('[\\u2028\\u2029]', 'g')

function safeStringify(data) {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(LINE_SEP_REGEX, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}

export default function JsonLd({ data }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeStringify(data) }}
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
