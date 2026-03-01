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
        } catch (err) {
            console.error('Auth callback error:', err)
            return NextResponse.redirect(`${origin}/login?error=unknown`)
        }
    }

    // Successful auth — redirect to dashboard
    return NextResponse.redirect(`${origin}/dashboard`)
}
