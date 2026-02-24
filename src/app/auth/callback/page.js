'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function AuthCallbackPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    useEffect(() => {
        // The Supabase client automatically detects hash fragments
        // (access_token, refresh_token) from the URL and sets up the session.
        // onAuthStateChange in AuthContext will fire, setting the user.
        // We just need to wait and redirect.

        if (!loading && user) {
            router.replace('/dashboard')
        }

        // If after 5 seconds we still don't have a user, redirect to login
        const timeout = setTimeout(() => {
            if (!user) {
                router.replace('/login?error=auth')
            }
        }, 5000)

        return () => clearTimeout(timeout)
    }, [user, loading, router])

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
