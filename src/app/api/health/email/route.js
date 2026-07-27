export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to') || '1133985163f@gmail.com'

        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
            return NextResponse.json({
                error: 'RESEND_API_KEY no está configurada en las variables de entorno de Vercel (env missing)',
                status: 'MISSING_ENV_KEY'
            }, { status: 500 })
        }

        const resend = new Resend(apiKey)

        const { data, error } = await resend.emails.send({
            from: 'Tu GlowUp <notificaciones@tu-glowup.com>',
            to: [to],
            subject: '🔍 Diagnóstico en Vivo — Tu GlowUp Production Email',
            html: `<div style="font-family: sans-serif; padding: 20px; background: #fff6f0; color: #1a0e1f;">
                <h2>Prueba de Diagnóstico en Producción</h2>
                <p>Este es un email de verificación enviado directamente desde Vercel.</p>
                <p>Fecha y hora: ${new Date().toLocaleString('es-AR')}</p>
            </div>`,
        })

        if (error) {
            return NextResponse.json({
                error: error.message || error,
                status: 'RESEND_API_ERROR',
                apiKeyPresent: true,
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            status: 'DELIVERED_TO_RESEND',
            id: data?.id,
            to,
            from: 'notificaciones@tu-glowup.com'
        })
    } catch (err) {
        return NextResponse.json({
            error: err.message || 'Exception during email test',
            status: 'EXCEPTION'
        }, { status: 500 })
    }
}
