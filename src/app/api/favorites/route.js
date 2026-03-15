import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// GET user's favorites
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    if (!userId) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })

    const { data, error } = await supabase
        .from('favorites')
        .select('*, businesses:business_id (id, name, business_type, address, services, slug)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ favorites: data || [] })
}

// POST toggle favorite
export async function POST(request) {
    try {
        const { user_id, business_id } = await request.json()
        if (!user_id || !business_id) {
            return NextResponse.json({ error: 'user_id y business_id requeridos' }, { status: 400 })
        }

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
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
