import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { validateInternationalPhone } from '@/lib/phone-validation'

export const dynamic = 'force-dynamic'

// POST: Add to waitlist
export async function POST(request) {
    try {
        const { business_id, date, client_phone, client_name, client_email, team_member_id, service_name } = await request.json()

        if (!business_id || !date || !client_phone) {
            return NextResponse.json({ error: 'Faltan campos requeridos (business_id, date, client_phone)' }, { status: 400 })
        }

        const phoneResult = validateInternationalPhone(client_phone)
        if (!phoneResult.valid) {
            return NextResponse.json({ error: phoneResult.error }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

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

// GET: List waitlist entries for a business
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const business_id = searchParams.get('business_id')
        const date = searchParams.get('date')

        if (!business_id) {
            return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

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
