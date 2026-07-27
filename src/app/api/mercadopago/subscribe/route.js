import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { createPlanPreference, PLANS } from '@/lib/mercadopago'

export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const supabase = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { planId, businessId } = body

        if (!planId || !PLANS[planId]) {
            return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
        }

        if (planId === 'custom') {
            return NextResponse.json({ error: 'El plan personalizado requiere contacto directo' }, { status: 400 })
        }

        // Obtener datos del negocio
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', businessId)
            .eq('owner_id', user.id)
            .single()

        if (bizError || !business) {
            return NextResponse.json({ error: 'Negocio no encontrado o sin permisos' }, { status: 404 })
        }

        const preference = await createPlanPreference({
            business,
            planId,
            userEmail: user.email,
        })

        // Guardar ID de preferencia en el negocio
        await supabase
            .from('businesses')
            .update({ mp_preference_id: preference.id })
            .eq('id', business.id)

        return NextResponse.json({
            success: true,
            checkoutUrl: preference.init_point || preference.sandbox_init_point,
            isDemo: preference.is_demo || false,
        })
    } catch (err) {
        console.error('API /api/mercadopago/subscribe error:', err)
        return NextResponse.json({ error: err.message || 'Error al procesar suscripción' }, { status: 500 })
    }
}
