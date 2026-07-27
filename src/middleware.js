import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
    let supabaseResponse = NextResponse.next({ request })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return supabaseResponse
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                )
                supabaseResponse = NextResponse.next({ request })
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                )
            },
        },
    })

    // Refresh the auth token — getUser() validates server-side
    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const host = request.headers.get('host') || ''

    // Redirección canónica: Si ingresan por .vercel.app en producción, redirigir a tu-glowup.com (excepto /api/ para webhooks)
    if (host.includes('vercel.app') && !pathname.startsWith('/api/')) {
        const redirectUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://www.tu-glowup.com')
        return NextResponse.redirect(redirectUrl, 301)
    }

    // Protect dashboard routes — redirect to login if not authenticated
    if (!user && pathname.startsWith('/dashboard')) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    // Protect admin routes — only superadmin can access
    if (user && pathname.startsWith('/dashboard/admin')) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'superadmin') {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    // Redirect authenticated users away from login/register
    if (user && (pathname === '/login' || pathname === '/register')) {
        // Check profile role to redirect correctly
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, business_id')
            .eq('id', user.id)
            .single()

        // If profile doesn't exist yet (new user), default to /book
        if (profileError || !profile) {
            return NextResponse.redirect(new URL('/book', request.url))
        }

        const isClient = profile.role === 'user' && !profile.business_id
        const redirectUrl = new URL(isClient ? '/book' : '/dashboard', request.url)
        return NextResponse.redirect(redirectUrl)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
