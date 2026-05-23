import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        // Trim and cap q + type to defend against memory exhaustion / weird inputs.
        // Strip Postgres ILIKE wildcards so users can't smuggle them into the pattern.
        const q = (searchParams.get('q') || '').slice(0, 100).replace(/[%_]/g, '')
        const type = (searchParams.get('type') || '').slice(0, 40)
        const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)

        // Public marketplace search — use anon key so RLS policies are enforced.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )

        let query = supabase
            .from('businesses')
            .select('id, name, business_type, address, slug, services')
            .limit(limit)

        if (q.trim()) {
            query = query.ilike('name', `%${q.trim()}%`)
        }

        if (type.trim()) {
            query = query.eq('business_type', type.trim())
        }

        const { data, error } = await query
        if (error) throw error

        let businesses = (data || []).map(biz => ({
            id: biz.id,
            name: biz.name,
            business_type: biz.business_type,
            address: biz.address || '',
            slug: biz.slug,
            services_count: Array.isArray(biz.services) ? biz.services.length : 0,
            avg_rating: 0,
            review_count: 0
        }))

        // Fetch ratings for these businesses
        if (businesses.length > 0) {
            const businessIds = businesses.map(b => b.id)
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('business_id, rating')
                .in('business_id', businessIds)

            if (reviewsData && reviewsData.length > 0) {
                // Group by business_id
                const ratingsMap = {}
                reviewsData.forEach(r => {
                    if (!ratingsMap[r.business_id]) ratingsMap[r.business_id] = { sum: 0, count: 0 }
                    ratingsMap[r.business_id].sum += r.rating
                    ratingsMap[r.business_id].count += 1
                })

                businesses = businesses.map(biz => {
                    const r = ratingsMap[biz.id]
                    if (r) {
                        return { 
                            ...biz, 
                            review_count: r.count, 
                            avg_rating: Math.round((r.sum / r.count) * 10) / 10 
                        }
                    }
                    return biz
                })
            }
        }

        // Sort by rating if not specifically a text search
        if (!q.trim()) {
            businesses.sort((a, b) => b.avg_rating - a.avg_rating)
        }

        return NextResponse.json({ businesses })
    } catch (err) {
        console.error('Business search error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
