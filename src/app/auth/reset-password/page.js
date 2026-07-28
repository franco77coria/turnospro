'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Eye, EyeOff, Check, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import styles from '../../login/login.module.css'

function ResetPasswordContent() {
    const router = useRouter()
    const [form, setForm] = useState({ password: '', confirm: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [checkingAuth, setCheckingAuth] = useState(true)
    const [hasAuthSession, setHasAuthSession] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        let isMounted = true

        const verifySession = async () => {
            if (!supabase) {
                if (isMounted) setCheckingAuth(false)
                return
            }

            // 1. Check if user is already authenticated via session/cookies
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session && isMounted) {
                    setHasAuthSession(true)
                    setCheckingAuth(false)
                    return
                }
            } catch (err) {
                console.error('Session check error:', err)
            }

            // 2. Listen for auth change (e.g. hash fragment token recovery)
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (!isMounted) return
                if (session || event === 'PASSWORD_RECOVERY') {
                    setHasAuthSession(true)
                    setCheckingAuth(false)
                }
            })

            // Grace period of 1.5 seconds for hash parsing or session sync
            const timer = setTimeout(() => {
                if (isMounted) setCheckingAuth(false)
            }, 1500)

            return () => {
                isMounted = false
                subscription.unsubscribe()
                clearTimeout(timer)
            }
        }

        verifySession()
    }, [])

    const handleReset = async (e) => {
        e.preventDefault()
        setError('')

        if (form.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }
        if (form.password !== form.confirm) {
            setError('Las contraseñas no coinciden')
            return
        }

        setLoading(true)
        try {
            if (!supabase) throw new Error('Sistema no disponible')
            const { error: updateError } = await supabase.auth.updateUser({
                password: form.password,
            })
            if (updateError) throw updateError
            setSuccess(true)
            setTimeout(() => router.push('/login'), 3000)
        } catch (err) {
            console.error('Reset password error:', err)
            setError(err.message || 'Error al cambiar la contraseña')
        }
        setLoading(false)
    }

    if (checkingAuth) {
        return (
            <div className={styles.loginPage}>
                <div className={styles.loginCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-8)' }}>
                    <div className="loading-spinner" />
                    <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Verificando enlace de recuperación...</p>
                </div>
            </div>
        )
    }

    if (!hasAuthSession && !success) {
        return (
            <div className={styles.loginPage}>
                <div className={styles.loginCard}>
                    <div className={styles.logo}>
                        <img src="/logo.png" alt="G" className={styles.logoMark} />
                    </div>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-4)'
                    }}>
                        <AlertCircle size={28} style={{ color: '#EF4444' }} />
                    </div>
                    <h1>Enlace no válido o expirado</h1>
                    <p>El enlace para restablecer tu contraseña ya expiró o no es válido. Por favor, solicitá uno nuevo.</p>
                    <Link href="/login" className={styles.primaryBtn} style={{ textDecoration: 'none', marginTop: 'var(--space-4)', display: 'block', textAlign: 'center' }}>
                        Solicitar nuevo enlace
                    </Link>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className={styles.loginPage}>
                <div className={styles.loginCard}>
                    <div className={styles.logo}>
                        <img src="/logo.png" alt="G" className={styles.logoMark} />
                    </div>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-4)'
                    }}>
                        <Check size={28} style={{ color: '#16A34A' }} />
                    </div>
                    <h1>Contraseña actualizada</h1>
                    <p>Tu contraseña fue cambiada exitosamente. Redirigiendo al inicio de sesión...</p>
                    <Link href="/login" className={styles.primaryBtn} style={{ textDecoration: 'none', marginTop: 'var(--space-4)', display: 'block', textAlign: 'center' }}>
                        Ir a iniciar sesión
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.logo}>
                    <img src="/logo.png" alt="G" className={styles.logoMark} />
                </div>
                <h1>Nueva contraseña</h1>
                <p>Elegí tu nueva contraseña para acceder a tu cuenta</p>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <form onSubmit={handleReset} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <Lock size={16} className={styles.inputIcon} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Nueva contraseña"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            required
                            minLength={6}
                            className={styles.formInput}
                        />
                        <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <div className={styles.inputGroup}>
                        <Lock size={16} className={styles.inputIcon} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Confirmar contraseña"
                            value={form.confirm}
                            onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                            required
                            className={styles.formInput}
                        />
                    </div>
                    <button type="submit" className={styles.primaryBtn} disabled={loading}>
                        {loading ? <div className="loading-spinner" /> : 'Actualizar contraseña'}
                    </button>
                </form>

                <Link href="/login" className={styles.backLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'var(--space-4)', textDecoration: 'none' }}>
                    <ArrowLeft size={14} /> Volver al login
                </Link>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className={styles.loginPage}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    )
}

