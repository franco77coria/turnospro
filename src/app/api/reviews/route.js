export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// Use anon key for read operations (respects RLS)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// GET reviews for a business (public, no auth needed)
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('business_id')
    if (!businessId) return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })

    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('*, profiles:user_id (full_name, avatar_url)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Error al cargar reseñas' }, { status: 500 })

    // Calculate average
    const count = reviews?.length || 0
    const avg = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0

    return NextResponse.json({ reviews: reviews || [], average: Math.round(avg * 10) / 10, count })
}

// POST a new review (requires auth)
export async function POST(request) {
    try {
        // Verify authenticated user
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { business_id, rating, comment } = body
        // Force user_id from authenticated user (prevent impersonation)
        const user_id = user.id

        if (!business_id || !rating) {
            return NextResponse.json({ error: 'Campos requeridos: business_id, rating' }, { status: 400 })
        }

        if (rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating debe ser entre 1 y 5' }, { status: 400 })
        }

        // Use admin client for write operations that need to bypass RLS
        const { createSupabaseAdmin } = await import('@/lib/supabase-admin')
        const adminSupabase = createSupabaseAdmin()

        // Check if user already reviewed this business
        const { data: existing } = await adminSupabase
            .from('reviews')
            .select('id')
            .eq('business_id', business_id)
            .eq('user_id', user_id)
            .maybeSingle()

        if (existing) {
            // Update existing review
            const { data, error } = await adminSupabase
                .from('reviews')
                .update({ rating, comment, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ review: data, updated: true })
        }

        // Create new review
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
