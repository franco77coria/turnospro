import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://glowup.com.ar'

export default async function sitemap() {
    // Static pages
    const staticPages = [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
        { url: `${BASE_URL}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
        { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    ]

    // Dynamic business pages
    let businessPages = []
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        const { data: businesses } = await supabase
            .from('businesses')
            .select('id, slug, updated_at')
            .limit(1000)

        businessPages = (businesses || []).map(biz => ({
            url: biz.slug ? `${BASE_URL}/book/s/${biz.slug}` : `${BASE_URL}/book/${biz.id}`,
            lastModified: biz.updated_at ? new Date(biz.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        }))
    } catch (err) {
        console.error('Sitemap error:', err)
    }

    return [...staticPages, ...businessPages]
}
