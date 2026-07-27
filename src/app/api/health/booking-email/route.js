export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/send-email'

/**
 * GET /api/health/booking-email?to=email@example.com&business_id=xxx
 * 
 * Simula EXACTAMENTE el flujo de sendBookingSideEffects paso por paso
 * y devuelve un JSON con los resultados de cada paso para diagnosticar.
 */
export async function GET(request) {
    const logs = []
    const log = (msg) => { logs.push(msg); console.log('[DiagBooking]', msg) }

    try {
        const { searchParams } = new URL(request.url)
        const to = searchParams.get('to') || '1133985163f@gmail.com'
        const businessId = searchParams.get('business_id') || 'ba401614-f1bc-4868-bd6e-5f98945dbb2f'

        log(`START — to: ${to}, business_id: ${businessId}`)

        // 1. Check RESEND_API_KEY
        const apiKey = process.env.RESEND_API_KEY
        log(`RESEND_API_KEY: ${apiKey ? `YES (${apiKey.substring(0,10)}...)` : 'NO — THIS IS THE PROBLEM'}`)
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
