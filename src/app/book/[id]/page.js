'use client'
import { useState } from 'react'
import { Heart, MapPin, Phone, LogOut, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import Reviews from '@/components/Reviews'
import Link from 'next/link'
import styles from './booking.module.css'
import { useBookingFlow } from '@/hooks/useBookingFlow'
import ProgressStepper from '@/components/booking/ProgressStepper'
import ServiceStep from '@/components/booking/ServiceStep'
import ProfessionalStep from '@/components/booking/ProfessionalStep'
import DateTimeStep from '@/components/booking/DateTimeStep'
import ConfirmStep from '@/components/booking/ConfirmStep'
import BookingSuccess from '@/components/booking/BookingSuccess'

export default function BookingPage() {
    const b = useBookingFlow()
    const { signOut } = useAuth()
    const biz = b.business
    const hasTm = b.teamMembers.length > 0
    const [expanded, setExpanded] = useState(false)

    if (b.loading) return <div className={styles.bookingPage}><div className={styles.loadingWrap}><div className="loading-spinner" /></div></div>

    if (!biz) return (
        <div className={styles.bookingPage}><div className={styles.container}><div className={styles.errorCard}>
            <h2>Negocio no encontrado</h2><p>El link de reservas no es valido o el negocio fue eliminado.</p>
        </div></div></div>
    )

    if (b.success) return (
        <BookingSuccess selectedService={b.selectedService} selectedDate={b.selectedDate}
            selectedTime={b.selectedTime} business={biz} onReset={b.resetBooking} />
    )

    return (
        <div className={styles.bookingPage}>
            <div className={styles.container}>
                <div className={styles.bookingHeader}>
                    {/* Fila compacta siempre visible */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                            <div className={styles.businessLogo} style={{ width: 40, height: 40, fontSize: 'var(--font-size-base)', marginBottom: 0, flexShrink: 0 }}>
                                {biz.name?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={{ fontSize: 'var(--font-size-lg)', margin: 0, textAlign: 'left' }}>{biz.name}</h1>
                                {biz.business_type && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                        {BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                            {b.user && (
                                <button onClick={b.toggleFavorite} className={styles.favBtn} style={{ position: 'static' }}
                                    title={b.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
                                    <Heart size={18} fill={b.isFavorite ? '#EF4444' : 'none'} color={b.isFavorite ? '#EF4444' : 'var(--text-tertiary)'} />
                                </button>
                            )}
                            <button
                                onClick={() => setExpanded(v => !v)}
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                                title={expanded ? 'Ocultar info' : 'Ver más info'}
                            >
                                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Info expandible */}
                    {expanded && (
                        <div style={{ width: '100%', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                            {biz.address && <p className={styles.address}><MapPin size={14} /> {biz.address}</p>}
                            {biz.phone && <p className={styles.address}><Phone size={14} /> {biz.phone}</p>}
                            {biz.settings?.description && (
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 'var(--space-2)', textAlign: 'center', maxWidth: 480 }}>
                                    {biz.settings.description}
                                </p>
                            )}
                            <Reviews businessId={biz.id} />
                        </div>
                    )}
                </div>

                <ProgressStepper step={b.step} teamMembers={b.teamMembers} />
                {b.error && <div className={styles.errorMsg}>{b.error}</div>}

                {b.step === 1 && <ServiceStep services={b.services} selectedService={b.selectedService}
                    onSelect={b.setSelectedService} onContinue={() => b.setStep(hasTm ? 2 : 3)} />}

                {b.step === 2 && hasTm && <ProfessionalStep teamMembers={b.teamMembers} selectedProfessional={b.selectedProfessional}
                    onSelect={(tm) => { b.setSelectedProfessional(tm); b.setStep(3) }} onBack={() => b.setStep(1)} />}

                {b.step === 3 && <DateTimeStep dates={b.dates} slots={b.slots} selectedDate={b.selectedDate} selectedTime={b.selectedTime}
                    loadingSlots={b.loadingSlots} hasTeamMembers={hasTm} onSelectDate={b.setSelectedDate} onSelectTime={b.setSelectedTime}
                    onContinue={() => b.setStep(4)} onBack={() => b.setStep(hasTm ? 2 : 1)}
                    businessId={biz.id} teamMemberId={b.selectedProfessional?.id} serviceName={b.selectedService?.name} />}

                {b.step === 4 && <ConfirmStep id={b.id} user={b.user} selectedService={b.selectedService}
                    selectedDate={b.selectedDate} selectedTime={b.selectedTime} form={b.form} setForm={b.setForm} submitting={b.submitting}
                    appliedCoupon={b.appliedCoupon} setAppliedCoupon={b.setAppliedCoupon} couponCode={b.couponCode} setCouponCode={b.setCouponCode}
                    couponError={b.couponError} handleApplyCoupon={b.handleApplyCoupon} handleBook={b.handleBook} onBack={() => b.setStep(3)} />}

                <div className={styles.footer}>
                    Powered by <Link href="/explore">GLOWUP</Link>
                    {b.user && (
                        <> — <button onClick={async () => { await signOut(); window.location.href = '/login' }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-tertiary)', fontSize: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <LogOut size={12} /> Cambiar cuenta
                        </button></>
                    )}
                </div>
            </div>
        </div>
    )
}
