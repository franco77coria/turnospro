export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyCronAuth } from '@/lib/cron-auth'

/**
 * Diagnóstico de envío de email. Estaba ABIERTO: cualquiera podía pedir
 * ?to=<cualquier dirección> y disparar un envío real desde el dominio
 * verificado, usándolo de relay de spam y quemando la cuota de Resend (y con
 * ella, la entregabilidad de las confirmaciones de turno reales).
 * Ahora exige el mismo secreto de servidor que el cron.
 */
export async function GET(request) {
    const unauth = verifyCronAuth(request)
    if (unauth) return unauth

    try {
        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to')
        if (!to || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) {
            return NextResponse.json({ error: 'Parámetro ?to= requerido y válido' }, { status: 400 })
        }

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
