'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { CalendarDays, Clock, User, Phone, Mail, Check, ArrowLeft, ArrowRight, MapPin, LogIn, Download, Heart, Tag } from 'lucide-react'
import { googleCalendarUrl, generateICS, downloadICS } from '@/lib/calendar-export'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import Reviews from '@/components/Reviews'
import styles from './booking.module.css'
import Link from 'next/link'

export default function BookingPage() {
    const { id } = useParams()
    const { user, loading: authLoading } = useAuth()
    const [business, setBusiness] = useState(null)
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState(1)
    const [selectedService, setSelectedService] = useState(null)
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedTime, setSelectedTime] = useState('')
    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [occupiedSlots, setOccupiedSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [isFavorite, setIsFavorite] = useState(false)
    const [couponCode, setCouponCode] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [couponError, setCouponError] = useState('')

    useEffect(() => {
        loadBusiness()
    }, [id])

    // Auto-fill form from logged-in user
    useEffect(() => {
        if (user && !form.name && !form.email) {
            setForm(prev => ({
                ...prev,
                name: user.user_metadata?.full_name || user.user_metadata?.name || prev.name,
                email: user.email || prev.email,
            }))
        }
    }, [user])

    async function loadBusiness() {
        if (!supabase) { setLoading(false); return }
        const { data } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .single()
        setBusiness(data)
        setLoading(false)
    }

    // Load occupied slots when date changes
    useEffect(() => {
        if (!selectedDate || !business?.id || !supabase) return
        setLoadingSlots(true)
        setSelectedTime('')
        supabase
            .from('appointments')
            .select('time, duration, team_member_id')
            .eq('business_id', business.id)
            .eq('date', selectedDate)
            .not('status', 'in', '("cancelled","no_show")')
            .then(({ data }) => {
                setOccupiedSlots((data || []).map(apt => {
                    const [h, m] = apt.time.split(':').map(Number)
                    const startMin = h * 60 + m
                    return { startMin, endMin: startMin + (apt.duration || 30) }
                }))
                setLoadingSlots(false)
            })
    }, [selectedDate, business?.id])

    // Generate available time slots (filtered by occupied + buffer + min advance)
    function getTimeSlots() {
        if (!business?.settings) return []
        const { work_hours } = business.settings
        const start = parseInt(work_hours?.start?.split(':')[0] || 9)
        const end = parseInt(work_hours?.end?.split(':')[0] || 20)
        const duration = selectedService?.duration || 30
        const bufferTime = business.settings?.buffer_time || 0
        const minAdvanceHours = business.settings?.min_advance_hours || 1

        const allSlots = []
        for (let h = start; h < end; h++) {
            allSlots.push(`${String(h).padStart(2, '0')}:00`)
            if (duration <= 30 && h < end) {
                allSlots.push(`${String(h).padStart(2, '0')}:30`)
            }
        }

        const now = new Date()
        const isToday = selectedDate === now.toISOString().split('T')[0]

        // Filter out occupied slots (with buffer) and past slots
        return allSlots.filter(slot => {
            const [sh, sm] = slot.split(':').map(Number)
            const slotStart = sh * 60 + sm
            const slotEnd = slotStart + duration

            // Check min advance time
            if (isToday) {
                const minTime = now.getHours() * 60 + now.getMinutes() + (minAdvanceHours * 60)
                if (slotStart < minTime) return false
            }

            // Check against occupied slots (including buffer time)
            return !occupiedSlots.some(o => {
                const occStart = o.startMin - bufferTime
                const occEnd = o.endMin + bufferTime
                return slotStart < occEnd && slotEnd > occStart
            })
        })
    }

    // Generate available dates (respecting max advance, work days, and closed dates)
    function getAvailableDates() {
        const dates = []
        const workDays = business?.settings?.work_days || [1, 2, 3, 4, 5, 6]
        const maxDays = business?.settings?.max_advance_days || 30
        const closedDates = (business?.settings?.closed_dates || []).map(cd => cd.date)

        for (let i = 1; i <= maxDays; i++) {
            const d = new Date()
            d.setDate(d.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]

            // Skip non-work days
            if (!workDays.includes(d.getDay())) continue

            // Skip closed dates (holidays)
            if (closedDates.includes(dateStr)) continue

            dates.push({
                value: dateStr,
                label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                dayName: d.toLocaleDateString('es-AR', { weekday: 'long' }),
            })
        }
        return dates
    }

    async function handleApplyCoupon(e) {
        e.preventDefault()
        setCouponError('')
        setAppliedCoupon(null)
        
        const codeToApply = couponCode.trim().toUpperCase()
        if (!codeToApply) return

        if (!supabase) return
        
        try {
            const { data: coupon, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('business_id', business.id)
                .eq('code', codeToApply)
                .eq('active', true)
                .single()

            if (error || !coupon) {
                setCouponError('Cupón inválido o inactivo')
                return
            }

            if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
                setCouponError('El cupón alcanzó su límite de usos')
                return
            }

            setAppliedCoupon(coupon)
            setCouponCode('') // clear input
        } catch (err) {
            console.error('Coupon error:', err)
            setCouponError('Error al validar cupón')
        }
    }


    async function handleBook(e) {
        e.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            // Create or find client
            let clientId
            const { data: existingClient } = await supabase
                .from('clients')
                .select('id')
                .eq('business_id', business.id)
                .eq('email', form.email)
                .single()

            if (existingClient) {
                clientId = existingClient.id
                await supabase.from('clients').update({
                    name: form.name,
                    phone: form.phone,
                    last_visit: new Date().toISOString(),
                }).eq('id', clientId)
            } else {
                const { data: newClient } = await supabase
                    .from('clients')
                    .insert([{
                        business_id: business.id,
                        name: form.name,
                        email: form.email,
                        phone: form.phone,
                        first_visit: new Date().toISOString(),
                        last_visit: new Date().toISOString(),
                        total_visits: 0,
                    }])
                    .select()
                    .single()
                clientId = newClient?.id
            }

            // Server-side availability check
            const checkRes = await fetch('/api/appointments/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: business.id,
                    date: selectedDate,
                    time: selectedTime,
                    duration: selectedService.duration || 30,
                }),
            })
            const checkData = await checkRes.json()
            if (!checkData.available) {
                setError('Este horario ya fue reservado. Elegí otro horario.')
                setSubmitting(false)
                return
            }

            // Create appointment
            const finalPrice = appliedCoupon ? (
                appliedCoupon.discount_type === 'percentage' 
                ? selectedService.price * (1 - appliedCoupon.discount_value / 100)
                : Math.max(0, selectedService.price - appliedCoupon.discount_value)
            ) : selectedService.price;

            const { data: createdAppointment, error: insertError } = await supabase.from('appointments').insert([{
                business_id: business.id,
                client_id: clientId,
                service_name: selectedService.name,
                date: selectedDate,
                time: selectedTime,
                duration: selectedService.duration,
                price: finalPrice,
                status: 'confirmed',
            }]).select('id').single()

            if (insertError) throw insertError

            // Increment coupon uses count if a coupon was used
            if (appliedCoupon) {
                await supabase.rpc('increment_coupon_uses', { coupon_id: appliedCoupon.id })
                    .catch(e => console.error('Non-critical coupon increment error:', e))
            }

            // Send confirmation email to client
            const formattedDate = new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
            try {
                await fetch('/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'confirmation',
                        to: form.email,
                        data: {
                            clientName: form.name,
                            serviceName: selectedService.name,
                            date: formattedDate,
                            time: selectedTime,
                            duration: selectedService.duration,
                            businessName: business.name,
                            businessType: business.business_type,
                            businessPhone: business.phone,
                            appointmentUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/book/my-appointments`,
                            appointmentId: createdAppointment?.id,
                        }
                    })
                })
            } catch (emailErr) {
                console.error('Email error (non-critical):', emailErr)
            }

            // Send notification email to business owner
            try {
                if (business.owner_id) {
                    // Get the owner's email
                    const { data: ownerProfile } = await supabase
                        .from('profiles')
                        .select('email')
                        .eq('id', business.owner_id)
                        .single()

                    if (ownerProfile?.email) {
                        await fetch('/api/email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'new_booking_notify',
                                to: ownerProfile.email,
                                data: {
                                    clientName: form.name,
                                    clientEmail: form.email,
                                    clientPhone: form.phone,
                                    serviceName: selectedService.name,
                                    date: formattedDate,
                                    time: selectedTime,
                                    duration: selectedService.duration,
                                    businessName: business.name,
                                    businessType: business.business_type,
                                    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/appointments`,
                                }
                            })
                        })
                    }
                }
            } catch (emailErr) {
                console.error('Business notify email error (non-critical):', emailErr)
            }

            // Create in-app notification for business owner
            try {
                if (business.owner_id) {
                    await supabase.from('notifications').insert([{
                        user_id: business.owner_id,
                        business_id: business.id,
                        type: 'appointment_booked',
                        title: 'Nuevo turno reservado',
                        message: `${form.name} reservó ${selectedService.name} para el ${new Date(selectedDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} a las ${selectedTime}.`,
                    }])
                }
            } catch (notifErr) {
                // non-critical
            }

            setSuccess(true)
        } catch (err) {
            console.error('Booking error:', err)
            setError('Error al reservar el turno. Intentá de nuevo.')
        }
        setSubmitting(false)
    }

    if (loading || authLoading) {
        return (
            <div className={styles.bookingPage}>
                <div className={styles.loadingWrap}>
                    <div className="loading-spinner" />
                </div>
            </div>
        )
    }

    if (!business) {
        return (
            <div className={styles.bookingPage}>
                <div className={styles.container}>
                    <div className={styles.errorCard}>
                        <h2>Negocio no encontrado</h2>
                        <p>El link de reservas no es válido o el negocio fue eliminado.</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className={styles.bookingPage}>
                <div className={styles.container}>
                    <div className={styles.bookingHeader}>
                        <div className={styles.businessLogo}>
                            {business.name?.[0]?.toUpperCase()}
                        </div>
                        <h1>{business.name}</h1>
                        {business.address && (
                            <p className={styles.address}><MapPin size={14} /> {business.address}</p>
                        )}
                    </div>
                    <div className={styles.errorCard} style={{ textAlign: 'center' }}>
                        <LogIn size={32} style={{ color: 'var(--accent)', marginBottom: 'var(--space-3)' }} />
                        <h2>Iniciá sesión para reservar</h2>
                        <p style={{ marginBottom: 'var(--space-4)' }}>
                            Para reservar un turno necesitás tener una cuenta en GLOWUP.
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href={`/login?redirect=/book/${id}`} className="btn btn-primary">
                                Iniciar sesión
                            </Link>
                            <Link href={`/register?redirect=/book/${id}`} className="btn btn-secondary">
                                Crear cuenta
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (success) {
        const dateObj = new Date(selectedDate)
        return (
            <div className={styles.bookingPage}>
                <div className={styles.container}>
                    <div className={styles.successCard}>
                        <div className={styles.successIcon}>
                            <Check size={32} />
                        </div>
                        <h1>Turno reservado</h1>
                        <p>Tu turno fue agendado exitosamente. Te enviamos un email de confirmación.</p>

                        <div className={styles.summaryCard}>
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Servicio</span>
                                <span className={styles.summaryValue}>{selectedService.name}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Fecha</span>
                                <span className={styles.summaryValue}>
                                    {dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Hora</span>
                                <span className={styles.summaryValue}>{selectedTime}</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Negocio</span>
                                <span className={styles.summaryValue}>{business.name}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                            <a
                                href={googleCalendarUrl({
                                    serviceName: selectedService.name,
                                    date: selectedDate,
                                    time: selectedTime,
                                    duration: selectedService.duration,
                                    businessName: business.name,
                                    address: business.address,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ flex: 1, minWidth: 180, textAlign: 'center', textDecoration: 'none' }}
                            >
                                <CalendarDays size={14} /> Google Calendar
                            </a>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, minWidth: 180 }}
                                onClick={() => {
                                    const ics = generateICS({
                                        serviceName: selectedService.name,
                                        date: selectedDate,
                                        time: selectedTime,
                                        duration: selectedService.duration,
                                        businessName: business.name,
                                        address: business.address,
                                    })
                                    downloadICS(ics)
                                }}
                            >
                                <Download size={14} /> Descargar .ics
                            </button>
                        </div>

                        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-3)' }}
                            onClick={() => { setSuccess(false); setStep(1); setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setForm({ name: '', email: '', phone: '' }) }}>
                            Reservar otro turno
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const services = business.services || []
    const dates = getAvailableDates()
    const slots = getTimeSlots()

    async function toggleFavorite() {
        if (!user) return
        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, business_id: business.id }),
            })
            const data = await res.json()
            setIsFavorite(data.favorited)
        } catch (err) {
            console.error('Favorite toggle error:', err)
        }
    }

    // Check favorite status on load
    useEffect(() => {
        if (user && business?.id) {
            fetch(`/api/favorites?user_id=${user.id}`)
                .then(r => r.json())
                .then(data => {
                    const fav = data.favorites?.some(f => f.business_id === business.id)
                    setIsFavorite(!!fav)
                })
                .catch(() => {})
        }
    }, [user?.id, business?.id])

    return (
        <div className={styles.bookingPage}>
            <div className={styles.container}>
                {/* Header */}
                <div className={styles.bookingHeader}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div className={styles.businessLogo}>
                                {business.name?.[0]?.toUpperCase()}
                            </div>
                            <h1>{business.name}</h1>
                        </div>
                        {user && (
                            <button
                                onClick={toggleFavorite}
                                className={styles.favBtn}
                                title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                            >
                                <Heart size={20} fill={isFavorite ? '#EF4444' : 'none'} color={isFavorite ? '#EF4444' : 'var(--text-tertiary)'} />
                            </button>
                        )}
                    </div>
                    {business.business_type && (
                        <span className="badge badge-accent" style={{ marginTop: 'var(--space-1)' }}>
                            {BUSINESS_TEMPLATES[business.business_type]?.name || business.business_type}
                        </span>
                    )}
                    {business.address && (
                        <p className={styles.address}><MapPin size={14} /> {business.address}</p>
                    )}
                    {business.phone && (
                        <p className={styles.address}><Phone size={14} /> {business.phone}</p>
                    )}
                    {business.settings?.description && (
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 'var(--space-2)', textAlign: 'center', maxWidth: 480 }}>
                            {business.settings.description}
                        </p>
                    )}
                    {/* Reviews */}
                    <Reviews businessId={business.id} />
                </div>

                {/* Progress */}
                <div className={styles.progress}>
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`${styles.progressStep} ${step >= s ? styles.progressActive : ''}`}>
                            <div className={styles.progressDot}>{step > s ? <Check size={12} /> : s}</div>
                            <span>{s === 1 ? 'Servicio' : s === 2 ? 'Fecha y hora' : 'Tus datos'}</span>
                        </div>
                    ))}
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                {/* Step 1: Service selection */}
                {step === 1 && (
                    <div className={styles.stepContent}>
                        <h2>Elegí un servicio</h2>
                        <div className={styles.serviceList}>
                            {services.map((s, i) => (
                                <button
                                    key={i}
                                    className={`${styles.serviceItem} ${selectedService?.name === s.name ? styles.selected : ''}`}
                                    onClick={() => setSelectedService(s)}
                                >
                                    <div>
                                        <span className={styles.serviceName}>{s.name}</span>
                                        <span className={styles.serviceMeta}>
                                            <Clock size={12} /> {s.duration} min
                                        </span>
                                    </div>
                                    <span className={styles.servicePrice}>${s.price?.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>
                        {selectedService && (
                            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
                                onClick={() => setStep(2)}>
                                Continuar <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                )}

                {/* Step 2: Date & time */}
                {step === 2 && (
                    <div className={styles.stepContent}>
                        <button className={styles.backBtn} onClick={() => setStep(1)}>
                            <ArrowLeft size={14} /> Cambiar servicio
                        </button>
                        <h2>Elegí fecha y hora</h2>

                        <h3 className={styles.subLabel}>Fecha</h3>
                        <div className={styles.dateGrid}>
                            {dates.map(d => (
                                <button
                                    key={d.value}
                                    className={`${styles.dateBtn} ${selectedDate === d.value ? styles.selected : ''}`}
                                    onClick={() => setSelectedDate(d.value)}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>

                        {selectedDate && (
                            <>
                                <h3 className={styles.subLabel}>Hora</h3>
                                {loadingSlots ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                                        <div className="loading-spinner" />
                                    </div>
                                ) : slots.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>
                                        No hay horarios disponibles para esta fecha. Probá con otro día.
                                    </p>
                                ) : (
                                    <div className={styles.timeGrid}>
                                        {slots.map(t => (
                                            <button
                                                key={t}
                                                className={`${styles.timeBtn} ${selectedTime === t ? styles.selected : ''}`}
                                                onClick={() => setSelectedTime(t)}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {selectedDate && selectedTime && (
                            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
                                onClick={() => setStep(3)}>
                                Continuar <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                )}

                {/* Step 3: Client info */}
                {step === 3 && (
                    <div className={styles.stepContent}>
                        <button className={styles.backBtn} onClick={() => setStep(2)}>
                            <ArrowLeft size={14} /> Cambiar fecha
                        </button>
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
                                        <Tag size={16} /> Cupón {appliedCoupon.code} aplicado (-{appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`})
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setAppliedCoupon(null)} style={{ color: 'var(--danger)' }}>Quitar</button>
                                </div>
                            ) : (
                                <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <input 
                                        className="input" 
                                        placeholder="Tengo un código de descuento" 
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
                                <label className="label"><Phone size={14} /> Teléfono</label>
                                <input className="input" placeholder="+54 11 1234-5678" value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting}>
                                {submitting ? <div className="loading-spinner" /> : (
                                    <><CalendarDays size={16} /> Confirmar turno</>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Footer */}
                <div className={styles.footer}>
                    Powered by <Link href="/explore">GLOWUP</Link>
                </div>
            </div>
        </div>
    )
}
