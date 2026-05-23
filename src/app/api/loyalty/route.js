import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { LoyaltyTxSchema, parseBody } from '@/lib/schemas'

/**
 * GET /api/loyalty?business_id=xxx — Get program info + client points
 * POST /api/loyalty — Earn/redeem points (owner or active staff only)
 */

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const businessId = searchParams.get('business_id')
        const clientId = searchParams.get('client_id')

        if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }
        if (clientId && !/^[0-9a-f-]{36}$/i.test(clientId)) {
            return NextResponse.json({ error: 'client_id inválido' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        const { data: program } = await supabase
            .from('loyalty_programs')
            .select('*')
            .eq('business_id', businessId)
            .eq('active', true)
            .single()

        if (!program) {
            return NextResponse.json({ program: null, points: null })
        }

        // Only return per-client points to authenticated staff/owner
        let points = null
        if (clientId) {
            const cookieStore = await cookies()
            const authClient = createSupabaseServerClient(cookieStore)
            const { data: { user } } = await authClient.auth.getUser()

            if (user) {
                const { data: biz } = await supabase
                    .from('businesses')
                    .select('owner_id')
                    .eq('id', businessId)
                    .single()

                let allowed = biz?.owner_id === user.id
                if (!allowed) {
                    const { data: member } = await supabase
                        .from('team_members')
                        .select('id')
                        .eq('business_id', businessId)
                        .eq('user_id', user.id)
                        .eq('active', true)
                        .maybeSingle()
                    allowed = !!member
                }
                // Also allow the client themself (by matching email)
                if (!allowed && user.email) {
                    const { data: client } = await supabase
                        .from('clients')
                        .select('email')
                        .eq('id', clientId)
                        .single()
                    allowed = client?.email && client.email.toLowerCase() === user.email.toLowerCase()
                }

                if (allowed) {
                    const { data } = await supabase
                        .from('loyalty_points')
                        .select('points, lifetime_points, updated_at')
                        .eq('program_id', program.id)
                        .eq('client_id', clientId)
                        .single()
                    points = data
                }
            }
        }

        return NextResponse.json({ program, points })
    } catch (err) {
        console.error('Loyalty GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(LoyaltyTxSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { program_id, client_id, points, type, description, appointment_id } = parsed.data

        const supabase = createSupabaseAdmin()

        // Ownership check via program -> business
        const { data: program } = await supabase
            .from('loyalty_programs')
            .select('business_id')
            .eq('id', program_id)
            .single()

        if (!program) {
            return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })
        }

        const { data: biz } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', program.business_id)
            .single()

        let allowed = biz?.owner_id === user.id
        if (!allowed) {
            const { data: member } = await supabase
                .from('team_members')
                .select('id')
                .eq('business_id', program.business_id)
                .eq('user_id', user.id)
                .eq('active', true)
                .maybeSingle()
            allowed = !!member
        }
        if (!allowed) {
            return NextResponse.json({ error: 'No tenés permisos para este programa' }, { status: 403 })
        }

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
