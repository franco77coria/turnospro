'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { validateInternationalPhone } from '@/lib/phone-validation'

export function useBookingFlow() {
    const { id } = useParams()
    const { user, loading: authLoading } = useAuth()
    const [business, setBusiness] = useState(null)
    const [loading, setLoading] = useState(true)
    const [step, setStep] = useState(1)
    const [selectedService, setSelectedService] = useState(null)
    const [selectedProfessional, setSelectedProfessional] = useState(null)
    const [teamMembers, setTeamMembers] = useState([])
    const [servicesList, setServicesList] = useState([])
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedTime, setSelectedTime] = useState('')
    const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [occupiedSlots, setOccupiedSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [isFavorite, setIsFavorite] = useState(false)
    const [couponCode, setCouponCode] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [couponError, setCouponError] = useState('')
    const [closureDates, setClosureDates] = useState([])
    const [teamAbsences, setTeamAbsences] = useState([])

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
        // Load team members for professional selection
        if (data?.id) {
            const { data: members } = await supabase
                .from('team_members')
                .select('id, name, role')
                .eq('business_id', data.id)
                .eq('active', true)
            setTeamMembers(members || [])

            // Load business closures
            const { data: closures } = await supabase
                .from('business_closures')
                .select('date')
                .eq('business_id', data.id)
                .gte('date', new Date().toISOString().split('T')[0])
            setClosureDates((closures || []).map(c => c.date))

            // Load team absences
            const { data: absences } = await supabase
                .from('team_absences')
                .select('team_member_id, start_date, end_date')
                .eq('business_id', data.id)
                .gte('end_date', new Date().toISOString().split('T')[0])
            setTeamAbsences(absences || [])

            // Load services from services table (fallback to JSONB)
            const { data: svcData, error: svcErr } = await supabase
                .from('services')
                .select('*')
                .eq('business_id', data.id)
                .eq('active', true)
                .order('sort_order')
            if (!svcErr && svcData?.length > 0) {
                setServicesList(svcData)
            } else {
                // Fallback to JSONB
                setServicesList(Array.isArray(data.services) ? data.services : [])
            }
        }
        setLoading(false)
    }

    // Load occupied slots when date changes
    useEffect(() => {
        if (!selectedDate || !business?.id || !supabase) return
        setLoadingSlots(true)
        setSelectedTime('')
        const tmId = selectedProfessional?.id
        let query = supabase
        query = query.from('appointments')
            .select('time, duration, team_member_id')
            .eq('business_id', business.id)
            .eq('date', selectedDate)
            .not('status', 'in', '("cancelled","no_show")')
        // Filter by professional if one is selected
        if (tmId) query = query.eq('team_member_id', tmId)
        query.then(({ data }) => {
                setOccupiedSlots((data || []).map(apt => {
                    const [h, m] = apt.time.split(':').map(Number)
                    const startMin = h * 60 + m
                    return { startMin, endMin: startMin + (apt.duration || 30) }
                }))
                setLoadingSlots(false)
            })
    }, [selectedDate, business?.id, selectedProfessional?.id])

    // Generate available time slots (filtered by occupied + buffer + min advance)
    function getTimeSlots() {
        if (!business) return []
        const settings = business.settings || {}
        const { work_hours } = settings
        const [startH, startM] = (work_hours?.start || '09:00').split(':').map(Number)
        const [endH, endM] = (work_hours?.end || '20:00').split(':').map(Number)
        const startMin = startH * 60 + (startM || 0)
        const endMin = endH * 60 + (endM || 0)
        const duration = selectedService?.duration || 30
        const bufferTime = settings.buffer_time || 0
        const minAdvanceHours = settings.min_advance_hours || 1
        const slotInterval = settings.slot_duration || (duration <= 30 ? 30 : 60)

        const allSlots = []
        for (let m = startMin; m + duration <= endMin; m += slotInterval) {
            const h = Math.floor(m / 60)
            const min = m % 60
            allSlots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
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

    // Generate available dates (respecting max advance, work days, closed dates, and absences)
    function getAvailableDates() {
        const dates = []
        const workDays = business?.settings?.work_days || [1, 2, 3, 4, 5, 6]
        const maxDays = business?.settings?.max_advance_days || 30
        // Merge JSONB closed_dates with business_closures table
        const settingsClosedDates = (business?.settings?.closed_dates || []).map(cd => cd.date)
        const allClosedDates = [...new Set([...settingsClosedDates, ...closureDates])]

        for (let i = 0; i <= maxDays; i++) {
            const d = new Date()
            d.setDate(d.getDate() + i)
            const dateStr = d.toISOString().split('T')[0]

            // Skip non-work days
            if (!workDays.includes(d.getDay())) continue

            // Skip closed dates (holidays + business_closures)
            if (allClosedDates.includes(dateStr)) continue

            // If a professional is selected, skip dates where they are absent
            if (selectedProfessional?.id) {
                const isAbsent = teamAbsences.some(a =>
                    a.team_member_id === selectedProfessional.id &&
                    dateStr >= a.start_date && dateStr <= a.end_date
                )
                if (isAbsent) continue
            }

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
                setCouponError('Cupon invalido o inactivo')
                return
            }

            // Validate coupon date range
            const now = new Date()
            if (coupon.valid_from && new Date(coupon.valid_from) > now) {
                setCouponError('Este cupon aun no esta vigente')
                return
            }
            if (coupon.valid_until && new Date(coupon.valid_until) < now) {
                setCouponError('Este cupon ha expirado')
                return
            }

            if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
                setCouponError('El cupon alcanzo su limite de usos')
                return
            }

            setAppliedCoupon(coupon)
            setCouponCode('') // clear input
        } catch (err) {
            console.error('Coupon error:', err)
            setCouponError('Error al validar cupon')
        }
    }

    async function handleBook(e) {
        e.preventDefault()
        setError('')

        // Validate phone before booking
        const phoneResult = validateInternationalPhone(form.phone)
        if (!phoneResult.valid) {
            setError(phoneResult.error)
            return
        }
        // Use formatted phone
        form.phone = phoneResult.formatted

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
                setError('Este horario ya fue reservado. Elegi otro horario.')
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
                team_member_id: selectedProfessional?.id || null,
                service_name: selectedService.name,
                date: selectedDate,
                time: selectedTime,
                duration: selectedService.duration,
                price: finalPrice,
                status: 'confirmed',
                notes: form.note?.trim() || null,
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
                        message: `${form.name} reservo ${selectedService.name} para el ${new Date(selectedDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} a las ${selectedTime}.`,
                    }])
                }
            } catch (notifErr) {
                // non-critical
            }

            setSuccess(true)
        } catch (err) {
            console.error('Booking error:', err)
            setError('Error al reservar el turno. Intenta de nuevo.')
        }
        setSubmitting(false)
    }

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

    function resetBooking() {
        setSuccess(false)
        setStep(1)
        setSelectedService(null)
        setSelectedDate('')
        setSelectedTime('')
        setForm({ name: '', email: '', phone: '', note: '' })
        setAppliedCoupon(null)
        setCouponCode('')
        setCouponError('')
    }

    const services = servicesList.length > 0 ? servicesList : (business?.services || [])
    const dates = getAvailableDates()
    const slots = getTimeSlots()

    return {
        // IDs
        id,
        // Auth
        user,
        authLoading,
        // Business
        business,
        loading,
        // Steps
        step,
        setStep,
        // Services
        services,
        servicesList,
        selectedService,
        setSelectedService,
        // Team / Professional
        teamMembers,
        selectedProfessional,
        setSelectedProfessional,
        // Date & Time
        dates,
        selectedDate,
        setSelectedDate,
        slots,
        selectedTime,
        setSelectedTime,
        loadingSlots,
        // Form
        form,
        setForm,
        // Submission
        submitting,
        success,
        error,
        handleBook,
        // Coupon
        couponCode,
        setCouponCode,
        appliedCoupon,
        setAppliedCoupon,
        couponError,
        handleApplyCoupon,
        // Favorites
        isFavorite,
        toggleFavorite,
        // Reset
        resetBooking,
    }
}
