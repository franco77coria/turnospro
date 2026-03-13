import { createClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'

export default async function SlugBookingPage({ params }) {
    const { slug } = await params

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

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
