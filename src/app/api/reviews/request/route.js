import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/send-email'
import { applyRateLimit } from '@/lib/rate-limit'
import { ReviewRequestSchema, parseBody } from '@/lib/schemas'

export async function POST(request) {
    try {
        // Auth + ownership: only the business owner or active staff can request a review.
        // Closes the open phishing/spam vector (anyone could POST arbitrary emails before).
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 30 review requests/hour/user max — covers normal business volume
        const rateLimited = applyRateLimit(request, {
            prefix: `review-req:${user.id}`,
            limit: 30,
            windowMs: 60 * 60 * 1000,
        })
        if (rateLimited) return rateLimited

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(ReviewRequestSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { client_email, client_name, service_name, business_id, business_name, business_type } = parsed.data

        // Verify caller is owner or active staff of business_id
        const supabase = createSupabaseAdmin()
        const { data: biz } = await supabase
            .from('businesses')
            .select('owner_id, name, business_type')
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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const reviewUrl = `${appUrl}/book/${business_id}#reviews`

        await sendEmail({
            type: 'review_request',
            to: client_email,
            data: {
                clientName: client_name || 'Cliente',
                serviceName: service_name,
                businessName: business_name || biz.name || 'GLOWUP',
                businessType: business_type || biz.business_type || 'custom',
                reviewUrl,
            },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Review request error:', err)
        return NextResponse.json({ error: 'Error al enviar solicitud' }, { status: 500 })
    }
}
