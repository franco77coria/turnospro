'use client'
import { Heart, MapPin, Phone } from 'lucide-react'
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
    const biz = b.business
    const hasTm = b.teamMembers.length > 0

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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div className={styles.businessLogo}>{biz.name?.[0]?.toUpperCase()}</div>
                            <h1>{biz.name}</h1>
                        </div>
                        {b.user && (
                            <button onClick={b.toggleFavorite} className={styles.favBtn}
                                title={b.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}>
                                <Heart size={20} fill={b.isFavorite ? '#EF4444' : 'none'} color={b.isFavorite ? '#EF4444' : 'var(--text-tertiary)'} />
                            </button>
                        )}
                    </div>
                    {biz.business_type && <span className="badge badge-accent" style={{ marginTop: 'var(--space-1)' }}>{BUSINESS_TEMPLATES[biz.business_type]?.name || biz.business_type}</span>}
                    {biz.address && <p className={styles.address}><MapPin size={14} /> {biz.address}</p>}
                    {biz.phone && <p className={styles.address}><Phone size={14} /> {biz.phone}</p>}
                    {biz.settings?.description && <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 'var(--space-2)', textAlign: 'center', maxWidth: 480 }}>{biz.settings.description}</p>}
                    <Reviews businessId={biz.id} />
                </div>

                <ProgressStepper step={b.step} teamMembers={b.teamMembers} />
                {b.error && <div className={styles.errorMsg}>{b.error}</div>}

                {b.step === 1 && <ServiceStep services={b.services} selectedService={b.selectedService}
                    onSelect={b.setSelectedService} onContinue={() => b.setStep(hasTm ? 2 : 3)} />}

                {b.step === 2 && hasTm && <ProfessionalStep teamMembers={b.teamMembers} selectedProfessional={b.selectedProfessional}
                    onSelect={(tm) => { b.setSelectedProfessional(tm); b.setStep(3) }} onBack={() => b.setStep(1)} />}

                {b.step === 3 && <DateTimeStep dates={b.dates} slots={b.slots} selectedDate={b.selectedDate} selectedTime={b.selectedTime}
                    loadingSlots={b.loadingSlots} hasTeamMembers={hasTm} onSelectDate={b.setSelectedDate} onSelectTime={b.setSelectedTime}
                    onContinue={() => b.setStep(4)} onBack={() => b.setStep(hasTm ? 2 : 1)} />}

                {b.step === 4 && <ConfirmStep id={b.id} user={b.user} selectedService={b.selectedService}
                    selectedDate={b.selectedDate} selectedTime={b.selectedTime} form={b.form} setForm={b.setForm} submitting={b.submitting}
                    appliedCoupon={b.appliedCoupon} setAppliedCoupon={b.setAppliedCoupon} couponCode={b.couponCode} setCouponCode={b.setCouponCode}
                    couponError={b.couponError} handleApplyCoupon={b.handleApplyCoupon} handleBook={b.handleBook} onBack={() => b.setStep(3)} />}

                <div className={styles.footer}>Powered by <Link href="/explore">GLOWUP</Link></div>
            </div>
        </div>
    )
}
