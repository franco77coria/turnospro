import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

/**
 * GET /api/loyalty?business_id=xxx — Get program info + client points
 * POST /api/loyalty — Earn/redeem points
 */

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const businessId = searchParams.get('business_id')
        const clientId = searchParams.get('client_id')

        if (!businessId) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Get the loyalty program for this business
        const { data: program } = await supabase
            .from('loyalty_programs')
            .select('*')
            .eq('business_id', businessId)
            .eq('active', true)
            .single()

        if (!program) {
            return NextResponse.json({ program: null, points: null })
        }

        // If client_id provided, get their points
        let points = null
        if (clientId) {
            const { data } = await supabase
                .from('loyalty_points')
                .select('points, lifetime_points, updated_at')
                .eq('program_id', program.id)
                .eq('client_id', clientId)
                .single()
            points = data
        }

        return NextResponse.json({ program, points })
    } catch (err) {
        console.error('Loyalty GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        // Verify auth
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { program_id, client_id, points, type, description, appointment_id } = body

        if (!program_id || !client_id || !points || !type) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        if (!['earn', 'redeem', 'adjust'].includes(type)) {
            return NextResponse.json({ error: 'Tipo inválido. Usar: earn, redeem, adjust' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Record transaction
        const { error: txErr } = await supabase
            .from('loyalty_transactions')
            .insert([{
                program_id,
                client_id,
                points: type === 'redeem' ? -Math.abs(points) : points,
                type,
                description: description || (type === 'earn' ? 'Puntos ganados' : type === 'redeem' ? 'Canje de puntos' : 'Ajuste'),
                appointment_id: appointment_id || null,
            }])

        if (txErr) throw txErr

        // Update or create point balance
        const pointDelta = type === 'redeem' ? -Math.abs(points) : points
        const { data: existing } = await supabase
            .from('loyalty_points')
            .select('id, points, lifetime_points')
            .eq('program_id', program_id)
            .eq('client_id', client_id)
            .single()

        if (existing) {
            const newPoints = Math.max(0, existing.points + pointDelta)
            const newLifetime = type === 'earn'
                ? existing.lifetime_points + points
                : existing.lifetime_points

            await supabase
                .from('loyalty_points')
                .update({ points: newPoints, lifetime_points: newLifetime, updated_at: new Date().toISOString() })
                .eq('id', existing.id)
        } else {
            await supabase
                .from('loyalty_points')
                .insert([{
                    program_id,
                    client_id,
                    points: Math.max(0, pointDelta),
                    lifetime_points: type === 'earn' ? points : 0,
                }])
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Loyalty POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
