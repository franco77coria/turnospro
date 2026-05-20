'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { User, Store, ArrowLeft, ArrowRight, Phone } from 'lucide-react'
import { validateInternationalPhone } from '@/lib/phone-validation'
import styles from './register.module.css'

export default function RegisterPage() {
    const router = useRouter()
    const { signInWithGoogle, isConfigured } = useAuth()
    const [step, setStep] = useState(1)
    const [accountType, setAccountType] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [phoneError, setPhoneError] = useState('')
    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: '',
        businessName: '',
        businessPhone: '',
    })

    const handleSelectType = (type) => {
        setAccountType(type)
        setStep(2)
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setError('')

        if (form.password !== form.confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }
        if (form.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        const phoneResult = validateInternationalPhone(form.phone)
        if (!phoneResult.valid) {
            setPhoneError(phoneResult.error)
            return
        }
        setPhoneError('')

        setLoading(true)
        try {
            if (!supabase) throw new Error('Sistema no disponible')

            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        full_name: form.fullName,
                        account_type: accountType,
                    }
                }
            })

            if (authError) throw authError

            if (authData.user) {
                // Check if user was actually created (not a duplicate with unconfirmed email)
                if (authData.user.identities?.length === 0) {
                    throw new Error('already registered')
                }

                // Create profile — business users get 'pending_business' until they complete onboarding
                const { error: profileError } = await supabase.from('profiles').upsert([{
                    id: authData.user.id,
                    email: form.email,
                    full_name: form.fullName,
                    phone: phoneResult.formatted,
                    role: accountType === 'business' ? 'pending_business' : 'user',
                }])
                if (profileError) {
                    console.error('Profile creation error:', profileError)
                }

                // Auto-login for both account types
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: form.email,
                    password: form.password,
                })
                if (!loginError) {
                    router.push(accountType === 'business' ? '/onboarding' : '/book')
                    return
                }
                // If auto-login fails (e.g. email confirmation required),
                // fall through to success screen with instructions
            }

            setSuccess(true)
        } catch (err) {
            console.error('Register error:', err)
            if (err.message?.includes('already registered')) {
                setError('Este email ya tiene una cuenta. Intentá iniciar sesión.')
            } else {
                setError(err.message || 'Error al crear la cuenta')
            }
        }
        setLoading(false)
    }

    if (success) {
        return (
            <div className={styles.registerPage}>
                <div className={styles.registerCard}>
                    <div className={styles.logo}>
                        <img src="/logo.png" alt="G" className={styles.logoMark} />
                    </div>
                    {accountType === 'business' ? (
                        <>
                            <h1>Cuenta creada</h1>
                            <p className={styles.successMsg}>
                                Tu cuenta de negocio fue creada. Iniciá sesión para configurar tu negocio.
                            </p>
                        </>
                    ) : (
                        <>
                            <h1>Cuenta creada</h1>
                            <p className={styles.successMsg}>
                                Tu cuenta fue creada exitosamente. Ya podés iniciar sesión.
                            </p>
                        </>
                    )}
                    <Link href={accountType === 'business' ? '/login' : '/login'} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-6)' }}>
                        Ir a iniciar sesión
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.registerPage}>
            <div className={styles.registerCard}>
                <div className={styles.logo}>
                    <img src="/logo.png" alt="G" className={styles.logoMark} />
                </div>

                {step === 1 ? (
                    <>
                        <h1>Crear cuenta</h1>
                        <p>Elegí el tipo de cuenta que necesitás</p>

                        <div className={styles.typeGrid}>
                            <button className={styles.typeCard} onClick={() => handleSelectType('user')}>
                                <User size={28} />
                                <h3>Cliente</h3>
                                <p>Quiero reservar turnos en negocios que usan GLOWUP</p>
                            </button>

                            <button className={styles.typeCard} onClick={() => handleSelectType('business')}>
                                <Store size={28} />
                                <h3>Negocio</h3>
                                <p>Quiero gestionar mi negocio con GLOWUP</p>
                                <span className={styles.approvalBadge}>Requiere aprobación</span>
                            </button>
                        </div>

                        <div className={styles.backLink}>
                            <Link href="/login">
                                <ArrowLeft size={14} /> Ya tengo cuenta
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={styles.stepHeader}>
                            <button className={styles.backBtn} onClick={() => setStep(1)}>
                                <ArrowLeft size={16} />
                            </button>
                            <div>
                                <h1>Registro de {accountType === 'business' ? 'Negocio' : 'Cliente'}</h1>
                                <p>Completá tus datos para crear la cuenta</p>
                            </div>
                        </div>

                        {error && <div className={styles.errorMsg}>{error}</div>}

                        <form onSubmit={handleRegister} className={styles.form}>
                            <div className="form-group">
                                <label className="label">Nombre completo *</label>
                                <input className="input" placeholder="Tu nombre" value={form.fullName}
                                    onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} required />
                            </div>

                            <div className="form-group">
                                <label className="label"><Phone size={14} /> Teléfono celular *</label>
                                <input className="input" placeholder="+54 11 1234-5678" value={form.phone}
                                    onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setPhoneError('') }} required />
                                {phoneError && <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>{phoneError}</p>}
                            </div>

                            <div className="form-group">
                                <label className="label">Email *</label>
                                <input className="input" type="email" placeholder="tu@email.com" value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                            </div>

                            <div className="form-group">
                                <label className="label">Contraseña *</label>
                                <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} />
                            </div>

                            <div className="form-group">
                                <label className="label">Confirmar contraseña *</label>
                                <input className="input" type="password" placeholder="Repetí tu contraseña" value={form.confirmPassword}
                                    onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} required />
                            </div>

                            {accountType === 'business' && (
                                <>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 'var(--space-4) 0' }} />
                                    <div className="form-group">
                                        <label className="label">Nombre del negocio *</label>
                                        <input className="input" placeholder="Ej: Barbería El Patrón" value={form.businessName}
                                            onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Teléfono del negocio</label>
                                        <input className="input" placeholder="Ej: +54 11 1234-5678" value={form.businessPhone}
                                            onChange={e => setForm(p => ({ ...p, businessPhone: e.target.value }))} />
                                    </div>
                                </>
                            )}

                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                                {loading ? <div className="loading-spinner" /> : (
                                    <>
                                        {accountType === 'business' ? 'Enviar solicitud' : 'Crear mi cuenta'}
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>

                            <div className={styles.divider}><span>o</span></div>

                            <button type="button" className={styles.googleBtn} onClick={async () => {
                                try {
                                    await signInWithGoogle(accountType)
                                } catch (err) {
                                    setError(err.message || 'Error con Google')
                                }
                            }} disabled={!isConfigured}>
                                <svg viewBox="0 0 24 24" width="18" height="18">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Registrarse con Google
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
