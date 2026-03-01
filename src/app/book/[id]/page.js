'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Clock, User, Phone, Mail, Check, ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import styles from './booking.module.css'

export default function BookingPage() {
    const { id } = useParams()
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

    useEffect(() => {
        loadBusiness()
    }, [id])

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

    // Generate available time slots
    function getTimeSlots() {
        if (!business?.settings) return []
        const { work_hours } = business.settings
        const start = parseInt(work_hours?.start?.split(':')[0] || 9)
        const end = parseInt(work_hours?.end?.split(':')[0] || 20)
        const duration = selectedService?.duration || 30
        const slots = []
        for (let h = start; h < end; h++) {
            slots.push(`${String(h).padStart(2, '0')}:00`)
            if (duration <= 30 && h < end) {
                slots.push(`${String(h).padStart(2, '0')}:30`)
            }
        }
        return slots
    }

    // Generate next 14 days
    function getAvailableDates() {
        const dates = []
        const workDays = business?.settings?.work_days || [1, 2, 3, 4, 5, 6]
        for (let i = 1; i <= 14; i++) {
            const d = new Date()
            d.setDate(d.getDate() + i)
            if (workDays.includes(d.getDay())) {
                dates.push({
                    value: d.toISOString().split('T')[0],
                    label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }),
                    dayName: d.toLocaleDateString('es-AR', { weekday: 'long' }),
                })
            }
        }
        return dates
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

            // Create appointment
            await supabase.from('appointments').insert([{
                business_id: business.id,
                client_id: clientId,
                service_name: selectedService.name,
                date: selectedDate,
                time: selectedTime,
                duration: selectedService.duration,
                price: selectedService.price,
                status: 'confirmed',
            }])

            // Send confirmation email
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
                            date: new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
                            time: selectedTime,
                            duration: selectedService.duration,
                            businessName: business.name,
                            businessType: business.business_type,
                            businessPhone: business.phone,
                            appointmentUrl: `https://glowup-turnos.vercel.app/book/${id}`,
                        }
                    })
                })
            } catch (emailErr) {
                console.error('Email error (non-critical):', emailErr)
            }

            setSuccess(true)
        } catch (err) {
            console.error('Booking error:', err)
            setError('Error al reservar el turno. Intentá de nuevo.')
        }
        setSubmitting(false)
    }

    if (loading) {
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

                        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
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

    return (
        <div className={styles.bookingPage}>
            <div className={styles.container}>
                {/* Header */}
                <div className={styles.bookingHeader}>
                    <div className={styles.businessLogo}>
                        {business.name?.[0]?.toUpperCase()}
                    </div>
                    <h1>{business.name}</h1>
                    {business.address && (
                        <p className={styles.address}><MapPin size={14} /> {business.address}</p>
                    )}
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
                            <span>{selectedService?.name}</span>
                            <span>
                                {new Date(selectedDate).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} — {selectedTime}
                            </span>
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
                    Powered by <a href="https://glowup-turnos.vercel.app" target="_blank" rel="noopener">GLOWUP</a>
                </div>
            </div>
        </div>
    )
}
