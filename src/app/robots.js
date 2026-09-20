import { appUrl } from '@/lib/app-url'

export default function robots() {
    const baseUrl = appUrl()
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
