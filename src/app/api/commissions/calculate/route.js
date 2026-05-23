import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CommissionsCalcSchema, parseBody } from '@/lib/schemas'

/**
 * POST /api/commissions/calculate
 * Calculate commissions for a business. Restricted to owner or team member with finance permission.
 */
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(CommissionsCalcSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { business_id, start_date, end_date } = parsed.data

        const supabase = createSupabaseAdmin()

        // Verify the caller is the business owner OR an active team member.
        // (Granular finance permission can be enforced later via team_members.role.)
        const { data: biz } = await supabase
            .from('businesses')
            .select('owner_id')
            .eq('id', business_id)
            .single()

        if (!biz) {
            return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
        }

        let allowed = biz.owner_id === user.id
        if (!allowed) {
            const { data: member } = await supabase
                .from('team_members')
                .select('id, role')
                .eq('business_id', business_id)
                .eq('user_id', user.id)
                .eq('active', true)
                .maybeSingle()
            // Only owner-equivalent roles see commissions for the whole business
            allowed = !!member && ['Dueño', 'Administrador', 'Gerente'].includes(member.role)
        }

        if (!allowed) {
            return NextResponse.json({ error: 'No tenés permisos para este negocio' }, { status: 403 })
        }

        // Get team members with commission rates
        const { data: members } = await supabase
            .from('team_members')
            .select('id, name, commission_rate')
            .eq('business_id', business_id)
            .eq('active', true)

        if (!members?.length) {
            return NextResponse.json({ commissions: [], total: 0 })
        }

        // Get completed appointments in range
        const { data: appointments } = await supabase
            .from('appointments')
            .select('id, team_member_id, service_name, price, date')
            .eq('business_id', business_id)
            .eq('status', 'completed')
            .gte('date', start_date)
            .lte('date', end_date)

        if (!appointments?.length) {
            return NextResponse.json({ commissions: [], total: 0 })
        }

        const commissionMap = {}
        for (const apt of appointments) {
            if (!apt.team_member_id || !apt.price) continue
            const member = members.find(m => m.id === apt.team_member_id)
            if (!member || !member.commission_rate) continue

            if (!commissionMap[member.id]) {
                commissionMap[member.id] = {
                    team_member_id: member.id,
                    name: member.name,
                    commission_rate: member.commission_rate,
                    total_sales: 0,
                    total_commission: 0,
                    appointments_count: 0,
                    details: [],
                }
            }

            const commission = Math.round(apt.price * member.commission_rate / 100 * 100) / 100
            commissionMap[member.id].total_sales += apt.price
            commissionMap[member.id].total_commission += commission
            commissionMap[member.id].appointments_count += 1
            commissionMap[member.id].details.push({
                appointment_id: apt.id,
                service: apt.service_name,
                date: apt.date,
                price: apt.price,
                commission,
            })
        }

        const commissions = Object.values(commissionMap)
        const total = commissions.reduce((sum, c) => sum + c.total_commission, 0)

        return NextResponse.json({
            commissions,
            total: Math.round(total * 100) / 100,
            period: { start_date, end_date },
        })
    } catch (err) {
        console.error('Commission calculation error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
