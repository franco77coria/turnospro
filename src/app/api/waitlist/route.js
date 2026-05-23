import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { validateInternationalPhone } from '@/lib/phone-validation'
import { applyRateLimit } from '@/lib/rate-limit'
import { WaitlistEntrySchema, parseBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

// POST: Add to waitlist
// Public on purpose — the waitlist form lives on the booking page, which
// is accessible without auth. PII is volunteered by the user. We defend
// with strict per-IP rate limiting + business existence check so attackers
// can't flood a victim business with junk entries.
export async function POST(request) {
    try {
        const rateLimited = await applyRateLimit(request, {
            prefix: 'waitlist',
            limit: 5,
            windowMs: 60 * 60 * 1000, // 5 entries / hour / IP
        })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(WaitlistEntrySchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { business_id, date, client_phone, client_name, client_email, team_member_id, service_name } = parsed.data

        const phoneResult = validateInternationalPhone(client_phone)
        if (!phoneResult.valid) {
            return NextResponse.json({ error: phoneResult.error }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Reject entries for non-existent businesses (prevents enumeration spam)
        const { data: biz } = await supabase
            .from('businesses')
            .select('id')
            .eq('id', business_id)
            .single()
        if (!biz) {
            return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
        }

        const { data, error } = await supabase.from('waitlist').insert([{
            business_id,
            date,
            client_phone: phoneResult.formatted,
            client_name: client_name || null,
            client_email: client_email || null,
            team_member_id: team_member_id || null,
            service_name: service_name || null,
        }]).select().single()

        if (error) throw error

        return NextResponse.json({ success: true, id: data.id })
    } catch (err) {
        console.error('Waitlist POST error:', err)
        return NextResponse.json({ error: 'Error al registrar en lista de espera' }, { status: 500 })
    }
}

// GET: List waitlist entries — restricted to business owner / active staff (PII).
export async function GET(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const business_id = searchParams.get('business_id')
        const date = searchParams.get('date')

        if (!business_id || !/^[0-9a-f-]{36}$/i.test(business_id)) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        const { data: biz } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', business_id)
            .single()

        if (!biz) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

        let allowed = biz.owner_id === user.id
        if (!allowed) {
            const { data: member } = await supabase
                .from('team_members')
                .select('id')
                .eq('business_id', business_id)
                .eq('user_id', user.id)
                .eq('active', true)
                .maybeSingle()
            allowed = !!member
        }
        if (!allowed) {
            return NextResponse.json({ error: 'No tenés permisos para este negocio' }, { status: 403 })
        }

        let query = supabase
            .from('waitlist')
            .select('*')
            .eq('business_id', business_id)
            .order('created_at', { ascending: false })

        if (date) {
            query = query.eq('date', date)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ entries: data || [] })
    } catch (err) {
        console.error('Waitlist GET error:', err)
        return NextResponse.json({ error: 'Error al obtener lista de espera' }, { status: 500 })
    }
}
