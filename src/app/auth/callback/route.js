import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET(request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const token_hash = requestUrl.searchParams.get('token_hash')
    const error = requestUrl.searchParams.get('error')
    const accountType = requestUrl.searchParams.get('account_type') // 'user' | 'business' | null
    const type = requestUrl.searchParams.get('type') // 'recovery' for password reset
    const next = requestUrl.searchParams.get('next')
    const origin = requestUrl.origin

    // If OAuth returned an error, redirect to login
    if (error) {
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
    }

    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient(cookieStore)

    // Password recovery flow handler
    if (type === 'recovery' || next === '/auth/reset-password') {
        if (code) {
            try {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                if (exchangeError) {
                    console.error('Code exchange error during recovery:', exchangeError.message)
                    return NextResponse.redirect(`${origin}/login?error=exchange`)
                }
            } catch (err) {
                console.error('Recovery exchange exception:', err)
                return NextResponse.redirect(`${origin}/login?error=unknown`)
            }
        } else if (token_hash) {
            try {
                const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
                if (verifyError) {
                    console.error('OTP verify error during recovery:', verifyError.message)
                    return NextResponse.redirect(`${origin}/login?error=verify`)
                }
            } catch (err) {
                console.error('Recovery verify exception:', err)
                return NextResponse.redirect(`${origin}/login?error=unknown`)
            }
        }

        // Always redirect to password reset page for recovery flow
        return NextResponse.redirect(`${origin}/auth/reset-password`)
    }

    if (code) {
        try {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
                console.error('Code exchange error:', exchangeError.message)
                return NextResponse.redirect(`${origin}/login?error=exchange`)
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Check if profile already exists
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, business_id')
                    .eq('id', user.id)
                    .single()

                if (profileError && profileError.code === 'PGRST116') {
                    // Profile doesn't exist — create it with the correct role
                    const role = accountType === 'business' ? 'pending_business' : 'user'
                    const { data: newProfile } = await supabase
                        .from('profiles')
                        .upsert([{
                            id: user.id,
                            email: user.email,
                            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
                            avatar_url: user.user_metadata?.avatar_url || null,
                            role,
                            account_type: accountType || 'user',
                        }], { onConflict: 'id' })
                        .select('role, business_id')
                        .single()

                    // Also update user metadata so AuthContext loadUserData
                    // knows the account type on subsequent loads
                    await supabase.auth.updateUser({
                        data: { account_type: accountType || 'user' }
                    })

                    // New user: route by role
                    if (role === 'user') {
                        return NextResponse.redirect(`${origin}/book`)
                    }
                    return NextResponse.redirect(`${origin}/dashboard`)
                }

                // Profile already exists — route based on existing role
                if (profile) {
                    let updatedRole = profile.role

                    // Sync role if it is out of sync with the intended signup accountType
                    if (accountType === 'user' && profile.role !== 'user' && !profile.business_id) {
                        updatedRole = 'user'
                        await supabase.from('profiles').update({ role: 'user', account_type: 'user' }).eq('id', user.id)
                    } else if (accountType === 'business' && profile.role === 'user') {
                        // Switch to business onboarding if they explicitly request business account type now
                        updatedRole = 'pending_business'
                        await supabase.from('profiles').update({ role: 'pending_business', account_type: 'business' }).eq('id', user.id)
                    }

                    const isClient = updatedRole === 'user' && !profile.business_id
                    return NextResponse.redirect(`${origin}${isClient ? '/book' : '/dashboard'}`)
                }
            }
        } catch (err) {
            console.error('Auth callback error:', err)
            return NextResponse.redirect(`${origin}/login?error=unknown`)
        }
    } else if (token_hash && type) {
        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash, type })
            if (verifyError) {
                console.error('Token verify error:', verifyError.message)
                return NextResponse.redirect(`${origin}/login?error=verify`)
            }
            return NextResponse.redirect(`${origin}/dashboard`)
        } catch (err) {
            console.error('Token verify catch error:', err)
            return NextResponse.redirect(`${origin}/login?error=unknown`)
        }
    }

    // Default: redirect to book (safe default for unknown users)
    return NextResponse.redirect(`${origin}/book`)
}

