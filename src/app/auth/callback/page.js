'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
    const router = useRouter()

    useEffect(() => {
        const handleCallback = async () => {
            if (!supabase) {
                router.replace('/login?error=config')
                return
            }

            try {
                // Check for error in URL params
                const params = new URLSearchParams(window.location.search)
                const errorParam = params.get('error')
                if (errorParam) {
                    console.error('Auth callback error:', errorParam)
                    router.replace(`/login?error=${errorParam}`)
                    return
                }

                // Check for code exchange (PKCE flow)
                const code = params.get('code')
                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code)
                    if (error) {
                        console.error('Code exchange error:', error)
                        router.replace('/login?error=exchange')
                        return
                    }
                }

                // Verify the user is now authenticated
                const { data: { user }, error } = await supabase.auth.getUser()

                if (error || !user) {
                    // Fallback: wait a moment and try again 
                    // (hash fragment flow might still be processing)
                    await new Promise(r => setTimeout(r, 1500))
                    const { data: { user: retryUser } } = await supabase.auth.getUser()

                    if (retryUser) {
                        router.replace('/dashboard')
                    } else {
                        router.replace('/login?error=auth')
                    }
                    return
                }

                router.replace('/dashboard')
            } catch (err) {
                console.error('Auth callback error:', err)
                router.replace('/login?error=unknown')
            }
        }

        handleCallback()
    }, [router])

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-primary)',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto var(--space-4)' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    Iniciando sesión...
                </p>
            </div>
        </div>
    )
}
