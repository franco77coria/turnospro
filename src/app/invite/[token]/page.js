'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { Briefcase, CheckCircle2, AlertCircle, ArrowRight, UserPlus } from 'lucide-react'

export default function InvitePage() {
    const { token } = useParams()
    const router = useRouter()
    const { user, profile, loading: authLoading, signInWithGoogle } = useAuth()
    
    const [inviteData, setInviteData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [accepting, setAccepting] = useState(false)

    useEffect(() => {
        if (token) checkInvite()
    }, [token])

    async function checkInvite() {
        if (!supabase) return
        setLoading(true)
        try {
            const { data, error: fetchErr } = await supabase
                .from('team_members')
                .select('id, name, role, invite_accepted, businesses(name)')
                .eq('invite_token', token)
                .is('user_id', null)
                .single()

            if (fetchErr) throw fetchErr
            if (!data || data.invite_accepted) throw new Error('Invitación ya utilizada')

            setInviteData(data)
        } catch (err) {
            console.error('Invite error:', err)
            setError(err.message || 'El enlace de invitación es inválido o expiró.')
        }
        setLoading(false)
    }

    async function handleAccept() {
        if (!user || !supabase) return
        setAccepting(true)
        setError('')
        try {
            const { error: rpcError } = await supabase.rpc('accept_invite', { p_token: token })
            if (rpcError) throw rpcError
            
            // Success, force refresh and redirect
            router.push('/dashboard')
            setTimeout(() => window.location.reload(), 500)
        } catch (err) {
            console.error('Accept error:', err)
            setError('No pudimos aceptar la invitación. Intentá de nuevo.')
            setAccepting(false)
        }
    }

    if (loading || authLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
                <div className="loading-spinner" />
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: 'var(--space-4)' }}>
            <div className="card" style={{ maxWidth: 440, width: '100%', padding: 'var(--space-8)', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 'var(--radius-full)', background: 'var(--accent-subtle)', color: 'var(--accent)', marginBottom: 'var(--space-6)' }}>
                    {error ? <AlertCircle size={32} /> : <UserPlus size={32} />}
                </div>

                {error ? (
                    <>
                        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Invitación no válida</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>{error}</p>
                        <Link href="/" className="btn btn-primary" style={{ width: '100%' }}>
                            Volver al inicio
                        </Link>
                    </>
                ) : (
                    <>
                        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Te invitaron a unirte</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-6)' }}>
                            Como <strong>{inviteData.role}</strong> en el equipo de <strong>{inviteData.businesses?.name}</strong>
                        </p>

                        {!user ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }}>
                                    Para aceptar la invitación, debés iniciar sesión o crear una cuenta.
                                </p>
                                <button className="btn btn-outline" onClick={() => signInWithGoogle()} style={{ width: '100%', height: 48 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Continuar con Google
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 'var(--space-2) 0' }}>
                                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>O inicia con email</span>
                                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                                </div>
                                <Link 
                                    href={`/login?redirect=/invite/${token}`} 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', height: 48 }}
                                >
                                    Iniciar Sesión
                                </Link>
                                <Link 
                                    href={`/register?redirect=/invite/${token}`} 
                                    className="btn btn-ghost" 
                                    style={{ width: '100%', height: 48 }}
                                >
                                    No tengo cuenta, Registrarme
                                </Link>
                            </div>
                        ) : (
                            <div style={{ background: 'var(--bg-primary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', textAlign: 'left', marginBottom: 'var(--space-6)' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Autenticado como:</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Avatar" style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)' }} />
                                    ) : (
                                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {user.email[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{profile?.full_name || 'Usuario'}</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>{user.email}</div>
                                    </div>
                                </div>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', marginTop: 'var(--space-4)', height: 48 }}
                                    onClick={handleAccept}
                                    disabled={accepting}
                                >
                                    {accepting ? <div className="loading-spinner" /> : (
                                        <>Aceptar Invitación <ArrowRight size={16} style={{ marginLeft: 8 }} /></>
                                    )}
                                </button>
                                <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'var(--space-2)' }} onClick={() => router.push('/')}>
                                    Volver
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
