export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { applyRateLimit } from '@/lib/rate-limit'
import { ReviewSchema, parseBody } from '@/lib/schemas'

// GET reviews for a business (public, no auth needed)
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('business_id')
    if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
        return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
    }

    // Anon client created per-request to avoid serverless state leaks
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*, profiles:user_id (full_name, avatar_url)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Error al cargar reseñas' }, { status: 500 })

    const count = reviews?.length || 0
    const avg = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0

    return NextResponse.json({ reviews: reviews || [], average: Math.round(avg * 10) / 10, count })
}

// POST a new review (requires auth)
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 5 reviews/min/user (write-side limit to prevent rating manipulation)
        const rateLimited = await applyRateLimit(request, {
            prefix: `review:${user.id}`,
            limit: 5,
            windowMs: 60000,
        })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(ReviewSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { business_id, rating, comment } = parsed.data
        const user_id = user.id

        const { createSupabaseAdmin } = await import('@/lib/supabase-admin')
        const adminSupabase = createSupabaseAdmin()

        const { data: existing } = await adminSupabase
            .from('reviews')
            .select('id')
            .eq('business_id', business_id)
            .eq('user_id', user_id)
            .maybeSingle()

        if (existing) {
            const { data, error } = await adminSupabase
                .from('reviews')
                .update({ rating, comment, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ review: data, updated: true })
        }

        const { data, error } = await adminSupabase
            .from('reviews')
            .insert([{ business_id, user_id, rating, comment: comment || '' }])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ review: data, created: true })
    } catch (err) {
        console.error('Review API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
