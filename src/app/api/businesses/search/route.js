import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q') || ''
        const type = searchParams.get('type') || ''
        const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50)

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

        const businesses = (data || []).map(biz => ({
            id: biz.id,
            name: biz.name,
            business_type: biz.business_type,
            address: biz.address || '',
            slug: biz.slug,
            services_count: Array.isArray(biz.services) ? biz.services.length : 0,
        }))

        return NextResponse.json({ businesses })
    } catch (err) {
        console.error('Business search error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
