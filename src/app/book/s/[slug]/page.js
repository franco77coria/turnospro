import { createClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
function createSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}

const TYPE_NAMES = {
    barberia: 'Barbería', peluqueria: 'Peluquería', unas: 'Uñas',
    lash: 'Lash & Cejas', spa: 'Spa & Estética', consultorio: 'Consultorio',
    veterinaria: 'Veterinaria', custom: 'Servicios'
}

export async function generateMetadata({ params }) {
    const { slug } = await params
    const supabase = createSupabase()

    const { data } = await supabase
        .from('businesses')
        .select('name, business_type, address')
        .eq('slug', slug)
        .single()

    if (!data) return { title: 'Negocio no encontrado | GLOWUP' }

    const typeName = TYPE_NAMES[data.business_type] || 'Servicios'

    return {
        title: `${data.name} - Reservar turno | GLOWUP`,
        description: `Reservá tu turno en ${data.name}. ${typeName} en ${data.address || 'tu zona'}. Agenda online 24/7.`,
        openGraph: {
            title: `${data.name} - Reservar turno`,
            description: `${typeName} - Reservá online en ${data.name}`,
            type: 'website',
        },
    }
}

export default async function SlugBookingPage({ params }) {
    const { slug } = await params
    const supabase = createSupabase()

    const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .single()

    if (data?.id) {
        redirect(`/book/${data.id}`)
    }

    notFound()
}
