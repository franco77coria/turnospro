export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/send-email'
import { verifyCronAuth } from '@/lib/cron-auth'

/**
 * GET /api/health/booking-email?to=email@example.com&business_id=xxx
 *
 * Simula el flujo de sendBookingSideEffects paso por paso para diagnosticar.
 *
 * Estaba ABIERTO y con valores por defecto: sin autenticación disparaba emails
 * reales a cualquier dirección, devolvía el prefijo de la RESEND_API_KEY y
 * filtraba el email del dueño de cualquier negocio cuyo id se adivinara.
 * Exige el mismo secreto de servidor que el cron.
 */
export async function GET(request) {
    const unauth = verifyCronAuth(request)
    if (unauth) return unauth

    const logs = []
    const log = (msg) => { logs.push(msg); console.log('[DiagBooking]', msg) }

    try {
        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to')
        const businessId = searchParams.get('business_id')

        if (!to || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) {
            return NextResponse.json({ error: 'Parámetro ?to= requerido y válido' }, { status: 400 })
        }
        if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
            return NextResponse.json({ error: 'Parámetro ?business_id= requerido' }, { status: 400 })
        }

        log(`START — to: ${to}, business_id: ${businessId}`)

        // 1. Check RESEND_API_KEY — presencia sí, contenido nunca.
        const apiKey = process.env.RESEND_API_KEY
        log(`RESEND_API_KEY: ${apiKey ? 'configurada' : 'FALTA — ESE ES EL PROBLEMA'}`)
        if (!apiKey) {
            return NextResponse.json({ error: 'RESEND_API_KEY missing', logs }, { status: 500 })
        }

        // 2. Create admin supabase
        let supabase
        try {
            supabase = createSupabaseAdmin()
            log('createSupabaseAdmin: ✅ OK')
        } catch (e) {
            log(`createSupabaseAdmin: ❌ FAILED — ${e.message}`)
            return NextResponse.json({ error: 'createSupabaseAdmin failed', logs }, { status: 500 })
        }

        // 3. Query business
        const { data: business, error: bizErr } = await supabase
            .from('businesses')
            .select('owner_id, name, business_type, phone')
            .eq('id', businessId)
            .maybeSingle()
        log(`Business query: ${business ? `✅ ${business.name} (owner: ${business.owner_id})` : `❌ null`} ${bizErr ? `ERR: ${bizErr.message}` : ''}`)

        // 4. Query owner profile
        let ownerEmail = null
        if (business?.owner_id) {
            const { data: ownerProfile, error: ownerErr } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', business.owner_id)
                .maybeSingle()
            log(`Owner profile: ${ownerProfile ? `✅ ${ownerProfile.email}` : `❌ null`} ${ownerErr ? `ERR: ${ownerErr.message}` : ''}`)
            ownerEmail = ownerProfile?.email
        }

        // 5. Send actual confirmation email via sendEmail
        log(`Calling sendEmail type=confirmation to=${to}...`)
        let emailResult
        try {
            emailResult = await sendEmail({
                type: 'confirmation',
                to: to,
                data: {
                    clientName: 'Test Diagnóstico',
                    serviceName: 'Servicio de Prueba',
                    date: 'lunes 25 de agosto',
                    time: '11:00',
                    duration: 30,
                    businessName: business?.name || 'Tu GlowUp',
                    businessType: business?.business_type || 'custom',
                    businessPhone: business?.phone,
                    appointmentUrl: 'https://www.tu-glowup.com/book/my-appointments',
                    appointmentId: 'test-diag-' + Date.now(),
                }
            })
            log(`sendEmail result: ${JSON.stringify(emailResult)}`)
        } catch (e) {
            log(`sendEmail EXCEPTION: ${e.message}`)
            emailResult = { error: e.message }
        }

        return NextResponse.json({
            success: !!emailResult?.success || !!emailResult?.id,
            emailResult,
            businessFound: !!business,
            businessName: business?.name,
            ownerEmail,
            logs,
        })
    } catch (err) {
        log(`FATAL: ${err.message}`)
        return NextResponse.json({ error: err.message, logs }, { status: 500 })
    }
}
