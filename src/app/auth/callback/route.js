import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const origin = requestUrl.origin

    // If OAuth returned an error, redirect to login
    if (error) {
        return NextResponse.redirect(`${origin}/login?error=${error}`)
    }

    if (code) {
        try {
            const cookieStore = await cookies()
            const supabase = createSupabaseServerClient(cookieStore)
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Code exchange error:', exchangeError.message)
                return NextResponse.redirect(`${origin}/login?error=exchange`)
            }

            // Check user role to decide redirect
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, business_id')
                    .eq('id', user.id)
                    .single()

                // Client users go to /book, business users go to /dashboard
                if (profile && profile.role === 'user' && !profile.business_id) {
                    return NextResponse.redirect(`${origin}/book`)
                }
            }
        } catch (err) {
            console.error('Auth callback error:', err)
            return NextResponse.redirect(`${origin}/login?error=unknown`)
        }
    }

    // Default: business users go to dashboard
    return NextResponse.redirect(`${origin}/dashboard`)
}
