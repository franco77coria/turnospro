export default function robots() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://glowup.com.ar'
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/dashboard/', '/api/', '/auth/', '/onboarding'],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
