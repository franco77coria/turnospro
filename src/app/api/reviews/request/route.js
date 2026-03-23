import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/send-email'

export async function POST(request) {
    try {
        const { client_email, client_name, service_name, business_id, business_name, business_type } = await request.json()

        if (!client_email || !business_id) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const reviewUrl = `${appUrl}/book/${business_id}#reviews`

        await sendEmail({
            type: 'review_request',
            to: client_email,
            data: {
                clientName: client_name || 'Cliente',
                serviceName: service_name,
                businessName: business_name || 'GLOWUP',
                businessType: business_type || 'custom',
                reviewUrl,
            },
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Review request error:', err)
        return NextResponse.json({ error: 'Error al enviar solicitud' }, { status: 500 })
    }
}
