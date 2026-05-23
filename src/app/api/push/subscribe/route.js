export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'
import { PushSubscriptionSchema, PushUnsubscribeSchema, parseBody } from '@/lib/schemas'

// POST: Register / update a push subscription for the authenticated user.
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(PushSubscriptionSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { subscription } = parsed.data

        const supabase = createSupabaseAdmin()

        const { data, error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'endpoint'
            })
            .select()

        if (error) {
            console.error('Error saving push subscription:', error)
            return NextResponse.json({ error: 'Error al registrar suscripción' }, { status: 500 })
        }

        return NextResponse.json({ success: true, subscription: data?.[0] })
    } catch (err) {
        console.error('Push subscribe API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE: remove a specific subscription for the authenticated user.
export async function DELETE(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(PushUnsubscribeSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }
        const { endpoint } = parsed.data

        const supabase = createSupabaseAdmin()

        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint)

        if (error) {
            console.error('Error deleting push subscription:', error)
            return NextResponse.json({ error: 'Error al eliminar suscripción' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Push unsubscribe API error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
