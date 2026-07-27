import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANS } from '@/lib/mercadopago'

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}

export async function POST(request) {
    try {
        const url = new URL(request.url)
        const type = url.searchParams.get('type') || url.searchParams.get('topic')
        const dataId = url.searchParams.get('data.id') || url.searchParams.get('id')

        const body = await request.json().catch(() => ({}))
        const paymentId = dataId || body?.data?.id || body?.id

        if (!paymentId) {
            return NextResponse.json({ status: 'ignored', reason: 'No payment id' })
        }

        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
        if (!accessToken) {
            console.warn('⚠️ Webhook recibido pero MERCADOPAGO_ACCESS_TOKEN no configurado')
            return NextResponse.json({ status: 'ignored', reason: 'No MP access token' })
        }

        // Consultar el estado del pago en Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!mpRes.ok) {
            return NextResponse.json({ status: 'error', reason: 'Failed to fetch payment status' }, { status: 400 })
        }

        const paymentData = await mpRes.json()

        if (paymentData.status === 'approved') {
            let extRef = {}
            try {
                extRef = JSON.parse(paymentData.external_reference || '{}')
            } catch (e) {
                console.error('Error parsing external_reference:', e)
            }

            const { business_id, plan_id, max_locations } = extRef

            if (business_id && plan_id && PLANS[plan_id]) {
                const supabase = getAdminSupabase()
                const planInfo = PLANS[plan_id]
                const maxLocs = max_locations || planInfo.maxLocations

                // Calcular vencimiento: 30 días a partir de hoy
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 30)

                // Actualizar negocio
                const { data: updatedBiz, error: updateError } = await supabase
                    .from('businesses')
                    .update({
                        plan_id: plan_id,
                        plan_status: 'active',
                        plan_expires_at: expiresAt.toISOString(),
                        max_locations: maxLocs,
                    })
                    .eq('id', business_id)
                    .select('owner_id')
                    .single()

                if (updateError) {
                    console.error('Error updating business subscription:', updateError)
                } else if (updatedBiz?.owner_id) {
                    // Auto-aprobar perfil del dueño
                    await supabase
                        .from('profiles')
                        .update({ approved: true })
                        .eq('id', updatedBiz.owner_id)
                }
            }
        }

        return NextResponse.json({ status: 'ok', paymentStatus: paymentData.status })
    } catch (err) {
        console.error('Mercado Pago Webhook error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Mercado Pago también realiza solicitudes GET/HEAD para verificar que la URL de webhook está activa
export async function GET() {
    return NextResponse.json({ status: 'ok', service: 'TurnosPro MercadoPago Webhook' })
}
