export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { cookies } from 'next/headers'

// POST: Registrar o actualizar una suscripción push
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { subscription } = body

        if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
            return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
        }

        const supabase = createSupabaseAdmin()

        // Guardar o actualizar la suscripción para el usuario
        // Usamos upsert basado en el endpoint que es único
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

// DELETE: Desuscribir / eliminar una suscripción específica
export async function DELETE(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { endpoint } = body

        if (!endpoint) {
            return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 })
        }

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
