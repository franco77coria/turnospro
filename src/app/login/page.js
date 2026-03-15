'use client'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import styles from './login.module.css'

function LoginContent() {
    const { user, profile, loading, signInWithGoogle, isConfigured } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loginLoading, setLoginLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [view, setView] = useState('login') // 'login' | 'forgot'
    const [form, setForm] = useState({ email: '', password: '' })
    const [forgotEmail, setForgotEmail] = useState('')

    useEffect(() => {
        if (!loading && user) {
            const explicit = searchParams.get('redirect')
            if (explicit) {
                router.replace(explicit)
            } else {
                const isClient = profile?.role === 'user' && !profile?.business_id
                router.replace(isClient ? '/book' : '/dashboard')
            }
        }
    }, [user, loading, profile, router, searchParams])

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoginLoading(true)
        try {
            if (!supabase) throw new Error('Sistema no disponible')
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: form.email,
                password: form.password,
            })
            if (authError) {
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('Email o contraseña incorrectos')
                }
                if (authError.message.includes('Email not confirmed')) {
                    throw new Error('Confirmá tu email antes de iniciar sesión. Revisá tu bandeja de entrada.')
                }
                throw authError
            }
        } catch (err) {
            console.error('Login error:', err)
            setError(err.message || 'Error al iniciar sesión')
        }
        setLoginLoading(false)
    }

    const handleGoogleLogin = async () => {
        if (!isConfigured) {
            setError('Sistema no configurado. Contacte al administrador.')
            return
        }
        try {
            setError('')
            await signInWithGoogle()
        } catch (err) {
            console.error('Login error:', err)
            setError(err.message || 'Error al iniciar sesión')
        }
    }

    const handleForgotPassword = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoginLoading(true)
        try {
            if (!supabase) throw new Error('Sistema no disponible')
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
            })
            if (resetError) throw resetError
            setSuccess('Te enviamos un email con instrucciones para restablecer tu contraseña. Revisá tu bandeja de entrada.')
        } catch (err) {
            console.error('Reset error:', err)
            setError(err.message || 'Error al enviar email de recuperación')
        }
        setLoginLoading(false)
    }

    const urlError = searchParams.get('error')
    const displayError = error || (urlError ? 'Error en la autenticación. Intentá de nuevo.' : '')

    // Forgot password view
    if (view === 'forgot') {
        return (
            <div className={styles.loginPage}>
                <div className={styles.loginCard}>
                    <div className={styles.logo}>
                        <span className={styles.logoMark}>G</span>
                    </div>
                    <h1>Recuperar contraseña</h1>
                    <p>Ingresá tu email y te enviaremos instrucciones</p>

                    {displayError && <div className={styles.errorMsg}>{displayError}</div>}
                    {success && <div className={styles.successMsg}>{success}</div>}

                    {!success && (
                        <form onSubmit={handleForgotPassword} className={styles.form}>
                            <div className={styles.inputGroup}>
                                <Mail size={16} className={styles.inputIcon} />
                                <input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={forgotEmail}
                                    onChange={e => setForgotEmail(e.target.value)}
                                    required
                                    className={styles.formInput}
                                />
                            </div>
                            <button type="submit" className={styles.primaryBtn} disabled={loginLoading}>
                                {loginLoading ? <div className="loading-spinner" /> : 'Enviar instrucciones'}
                            </button>
                        </form>
                    )}

                    <button className={styles.backLink} onClick={() => { setView('login'); setError(''); setSuccess('') }}>
                        <ArrowLeft size={14} /> Volver al login
                    </button>
                </div>
            </div>
        )
    }

    // Main login view
    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.logo}>
                    <span className={styles.logoMark}>G</span>
                </div>
                <h1>Iniciar sesión</h1>
                <p>Accedé a tu cuenta de GLOWUP</p>

                {displayError && <div className={styles.errorMsg}>{displayError}</div>}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <Mail size={16} className={styles.inputIcon} />
                        <input
                            type="email"
                            placeholder="tu@email.com"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            required
                            className={styles.formInput}
                            autoComplete="email"
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <Lock size={16} className={styles.inputIcon} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Tu contraseña"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            required
                            className={styles.formInput}
                            autoComplete="current-password"
                        />
                        <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <button type="button" className={styles.forgotLink} onClick={() => { setView('forgot'); setError('') }}>
                        ¿Olvidaste tu contraseña?
                    </button>

                    <button type="submit" className={styles.primaryBtn} disabled={loginLoading || loading}>
                        {loginLoading ? <div className="loading-spinner" /> : 'Iniciar sesión'}
                    </button>
                </form>

                <div className={styles.divider}><span>o</span></div>

                {/* Google OAuth */}
                <button className={styles.googleBtn} onClick={handleGoogleLogin} disabled={loading}>
                    <svg viewBox="0 0 24 24" width="18" height="18">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continuar con Google
                </button>

                <div className={styles.divider}><span>o</span></div>

                <Link href="/register" className={styles.registerLink}>
                    Crear una cuenta nueva
                </Link>

                <p className={styles.terms}>
                    Al continuar, aceptás nuestros términos de servicio y política de privacidad.
                </p>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className={styles.loginPage}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-10)' }}>
                    <div className="loading-spinner" />
                </div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}
