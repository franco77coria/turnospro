export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'

// GET user's favorites (requires auth)
export async function GET(request) {
    // Verify authenticated user
    const cookieStore = await cookies()
    const authClient = createSupabaseServerClient(cookieStore)
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Force user_id from auth (ignore query param to prevent data leaks)
    const userId = user.id
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
        .from('favorites')
        .select('*, businesses:business_id (id, name, business_type, address, services, slug)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Error al cargar favoritos' }, { status: 500 })
    return NextResponse.json({ favorites: data || [] })
}

// POST toggle favorite (requires auth)
export async function POST(request) {
    try {
        // Verify authenticated user
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { business_id } = await request.json()
        // Force user_id from auth (prevent impersonation)
        const user_id = user.id
        if (!business_id) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Check if already favorited
        const { data: existing } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', user_id)
            .eq('business_id', business_id)
            .maybeSingle()

        if (existing) {
            // Remove favorite
            await supabase.from('favorites').delete().eq('id', existing.id)
            return NextResponse.json({ favorited: false })
        }

        // Add favorite
        await supabase.from('favorites').insert([{ user_id, business_id }])
        return NextResponse.json({ favorited: true })
    } catch (err) {
        console.error('Favorites API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
