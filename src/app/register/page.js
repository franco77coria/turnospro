'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User, Store, ArrowLeft, ArrowRight } from 'lucide-react'
import styles from './register.module.css'

export default function RegisterPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [accountType, setAccountType] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
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
                // Create profile — only use columns that exist in the schema
                const { error: profileError } = await supabase.from('profiles').upsert([{
                    id: authData.user.id,
                    email: form.email,
                    full_name: form.fullName,
                    role: accountType === 'business' ? 'Dueño' : 'user',
                }])
                if (profileError) {
                    console.error('Profile creation error:', profileError)
                    // Profile creation failed but auth user was created - still show success
                }
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
                        <span className={styles.logoMark}>T</span>
                    </div>
                    {accountType === 'business' ? (
                        <>
                            <h1>Solicitud enviada</h1>
                            <p className={styles.successMsg}>
                                Tu cuenta de negocio fue creada. Un administrador revisará tu solicitud
                                y la aprobará a la brevedad. Te notificaremos por email.
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>
                                Negocio: <strong>{form.businessName}</strong>
                            </p>
                        </>
                    ) : (
                        <>
                            <h1>Cuenta creada</h1>
                            <p className={styles.successMsg}>
                                Tu cuenta fue creada exitosamente. Revisá tu email para confirmar
                                la cuenta y luego iniciá sesión.
                            </p>
                        </>
                    )}
                    <Link href="/login" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-6)' }}>
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
                    <span className={styles.logoMark}>T</span>
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
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
