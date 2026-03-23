import { ArrowLeft, CalendarDays, User, Mail, Phone, LogIn, Tag } from 'lucide-react'
import Link from 'next/link'
import styles from '@/app/book/[id]/booking.module.css'

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

            {!user ? (
                <>
                    <h2>Inicia sesion para confirmar</h2>
                    <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
                        <LogIn size={32} style={{ color: 'var(--accent)', marginBottom: 'var(--space-3)' }} />
                        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                            Para confirmar tu turno necesitas una cuenta en GLOWUP.
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href={`/login?redirect=/book/${id}`} className="btn btn-primary">
                                Iniciar sesion
                            </Link>
                            <Link href={`/register?redirect=/book/${id}`} className="btn btn-secondary">
                                Crear cuenta
                            </Link>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <h2>Tus datos</h2>

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
                            <label className="label"><Phone size={14} /> Telefono</label>
                            <input className="input" placeholder="+54 11 1234-5678" value={form.phone}
                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting}>
                            {submitting ? <div className="loading-spinner" /> : (
                                <><CalendarDays size={16} /> Confirmar turno</>
                            )}
                        </button>
                    </form>
                </>
            )}
        </div>
    )
}
