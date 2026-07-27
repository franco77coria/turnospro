import { useState } from 'react'
import { ArrowLeft, CalendarDays, User, Mail, Phone, LogIn, Tag, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import styles from '@/app/book/[id]/booking.module.css'

const COUNTRIES = [
    { code: '+54', label: 'Argentina 🇦🇷', placeholder: '11 1234-5678' },
    { code: '+598', label: 'Uruguay 🇺🇾', placeholder: '9 123 456' },
    { code: '+55', label: 'Brasil 🇧🇷', placeholder: '11 9 1234-5678' },
    { code: '+56', label: 'Chile 🇨🇱', placeholder: '9 1234 5678' },
    { code: '+595', label: 'Paraguay 🇵🇾', placeholder: '981 123 456' },
    { code: '+591', label: 'Bolivia 🇧🇴', placeholder: '7 123 4567' },
    { code: '+57', label: 'Colombia 🇨🇴', placeholder: '300 123 4567' },
    { code: '+52', label: 'México 🇲🇽', placeholder: '55 1234 5678' },
    { code: '+34', label: 'España 🇪🇸', placeholder: '612 345 678' },
    { code: '+1', label: 'USA/Canadá 🇺🇸', placeholder: '555 123 4567' },
]

function PhoneInput({ value, onChange }) {
    // Parse existing value to extract country code
    const detectCountry = (phone) => {
        if (!phone) return COUNTRIES[0]
        // Try longest codes first to avoid +1 matching +55 etc.
        const sorted = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)
        return sorted.find(c => phone.startsWith(c.code)) || COUNTRIES[0]
    }

    const detected = detectCountry(value)
    const [countryCode, setCountryCode] = useState(detected.code)
    const [localPhone, setLocalPhone] = useState(
        value && value.startsWith(detected.code) ? value.slice(detected.code.length) : ''
    )

    const selectedCountry = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0]

    const handleCountryChange = (newCode) => {
        setCountryCode(newCode)
        const digits = localPhone.replace(/\D/g, '')
        onChange(newCode + digits)
    }

    const handleLocalChange = (raw) => {
        setLocalPhone(raw)
        const digits = raw.replace(/\D/g, '')
        onChange(countryCode + digits)
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <select
                    value={countryCode}
                    onChange={e => handleCountryChange(e.target.value)}
                    className="input"
                    style={{ width: 'auto', flexShrink: 0, cursor: 'pointer' }}
                >
                    {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                    ))}
                </select>
                <input
                    className="input"
                    placeholder={selectedCountry.placeholder}
                    value={localPhone}
                    onChange={e => handleLocalChange(e.target.value)}
                    inputMode="tel"
                    style={{ flex: 1 }}
                />
            </div>
            {localPhone && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-1)' }}>
                    Número completo: {countryCode}{localPhone.replace(/\D/g, '')}
                </p>
            )}
        </div>
    )
}

export default function ConfirmStep({
    id,
    user,
    selectedService,
    selectedDate,
    selectedTime,
    form,
    setForm,
    submitting,
    appliedCoupon,
    setAppliedCoupon,
    couponCode,
    setCouponCode,
    couponError,
    handleApplyCoupon,
    handleBook,
    onBack,
}) {
    return (
        <div className={styles.stepContent}>
            <button className={styles.backBtn} onClick={onBack}>
                <ArrowLeft size={14} /> Cambiar fecha
            </button>

            {!user && (
                <div style={{ background: 'var(--bg-secondary)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                        ¿Tenés cuenta en Tu GlowUp?
                    </span>
                    <Link href={`/login?redirect=/book/${id}`} style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                        Iniciar sesión (opcional) →
                    </Link>
                </div>
            )}

            <h2>Completá tus datos</h2>

                    <div className={styles.bookingSummary}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                            <span>{selectedService?.name}</span>
                            <div>
                                {appliedCoupon ? (
                                    <>
                                        <span style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginRight: 'var(--space-2)' }}>
                                            ${selectedService?.price?.toLocaleString()}
                                        </span>
                                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                                            ${(appliedCoupon.discount_type === 'percentage'
                                                ? selectedService.price * (1 - appliedCoupon.discount_value / 100)
                                                : Math.max(0, selectedService.price - appliedCoupon.discount_value)
                                            ).toLocaleString()}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ fontWeight: 600 }}>${selectedService?.price?.toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} — {selectedTime}
                        </span>
                    </div>

                    {/* Coupon Form */}
                    <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        {appliedCoupon ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--success)', fontWeight: 600 }}>
                                    <Tag size={16} /> Cupon {appliedCoupon.code} aplicado (-{appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`})
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => setAppliedCoupon(null)} style={{ color: 'var(--danger)' }}>Quitar</button>
                            </div>
                        ) : (
                            <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <input
                                    className="input"
                                    placeholder="Tengo un codigo de descuento"
                                    value={couponCode}
                                    onChange={e => setCouponCode(e.target.value)}
                                    style={{ textTransform: 'uppercase' }}
                                />
                                <button type="submit" className="btn btn-secondary">Aplicar</button>
                            </form>
                        )}
                        {couponError && <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>{couponError}</p>}
                    </div>

                    <form onSubmit={handleBook} className={styles.form}>
                        <div className="form-group">
                            <label className="label"><User size={14} /> Nombre completo *</label>
                            <input className="input" placeholder="Tu nombre" value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                        </div>
                        <div className="form-group">
                            <label className="label"><Mail size={14} /> Email *</label>
                            <input className="input" type="email" placeholder="tu@email.com" value={form.email}
                                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                        </div>
                        <div className="form-group">
                            <label className="label"><Phone size={14} /> Teléfono celular *</label>
                            <PhoneInput
                                value={form.phone}
                                onChange={phone => setForm(p => ({ ...p, phone }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label"><MessageSquare size={14} /> Nota para el negocio <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(opcional)</span></label>
                            <textarea
                                className="input"
                                placeholder="Ej: quiero el corte al ras, es mi primera vez, tengo alergia a..."
                                value={form.note || ''}
                                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                                rows={2}
                                style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                            />
                        </div>

                        {!user && (
                            <div style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={form.createAccount || false}
                                        onChange={e => setForm(p => ({ ...p, createAccount: e.target.checked }))}
                                        style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                                    />
                                    Crear mi cuenta en Tu GlowUp para gestionar mis turnos
                                </label>

                                {form.createAccount && (
                                    <div className="form-group" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
                                        <label className="label" style={{ fontSize: 'var(--font-size-xs)' }}>Crear una contraseña *</label>
                                        <input
                                            className="input"
                                            type="password"
                                            placeholder="Mínimo 6 caracteres"
                                            value={form.password || ''}
                                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                            required={form.createAccount}
                                            minLength={6}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting}>
                            {submitting ? <div className="loading-spinner" /> : (
                                <>
                                    <CalendarDays size={16} />
                                    {form.createAccount ? 'Confirmar turno y crear mi cuenta' : 'Confirmar turno'}
                                </>
                            )}
                        </button>
                    </form>
        </div>
    )
}
