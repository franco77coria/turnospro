import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * POST /api/commissions/calculate
 * Calculate and record commissions for a given business and date range
 * Body: { business_id, start_date, end_date }
 */
export async function POST(request) {
    try {
        const body = await request.json()
        const { business_id, start_date, end_date } = body

        if (!business_id || !start_date || !end_date) {
            return NextResponse.json({ error: 'business_id, start_date y end_date requeridos' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

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

        // Calculate commissions per team member
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
