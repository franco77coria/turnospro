'use client'
import { useCallback, useEffect, useState } from 'react'
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

    // Auto-fill form from logged-in user or previous guest bookings saved in localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedName = localStorage.getItem('glowup_guest_name') || ''
            const savedEmail = localStorage.getItem('glowup_guest_email') || ''
            const savedPhone = localStorage.getItem('glowup_guest_phone') || ''

            setForm(prev => ({
                ...prev,
                name: user?.user_metadata?.full_name || user?.user_metadata?.name || prev.name || savedName,
                email: user?.email || prev.email || savedEmail,
                phone: prev.phone || savedPhone,
            }))
        }
    }, [user])

    const loadBusiness = useCallback(async () => {
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
    }, [id])

    useEffect(() => {
        loadBusiness()
    }, [loadBusiness])

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
            .not('status', 'in', '(cancelled,no_show)')
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
        const formattedPhone = phoneResult.formatted

        setSubmitting(true)

        try {
            // Si el invitado eligió crear cuenta al agendar, registrarlo automáticamente
            if (!user && form.createAccount) {
                if (!form.password || form.password.length < 6) {
                    setError('La contraseña debe tener al menos 6 caracteres')
                    setSubmitting(false)
                    return
                }

                const { data: authData, error: signUpErr } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                    options: { data: { full_name: form.name, account_type: 'user' } }
                })
                if (signUpErr && !signUpErr.message?.includes('already registered')) {
                    setError(signUpErr.message || 'Error al crear la cuenta')
                    setSubmitting(false)
                    return
                }

                if (authData?.user) {
                    await supabase.from('profiles').upsert([{
                        id: authData.user.id,
                        email: form.email,
                        full_name: form.name,
                        phone: formattedPhone,
                        role: 'user',
                        account_type: 'user',
                    }], { onConflict: 'id' })

                    await supabase.auth.signInWithPassword({
                        email: form.email,
                        password: form.password,
                    })
                }
            }

            // La búsqueda y creación/vinculación del cliente se realiza de manera atómica en el servidor (/api/appointments)
            let clientId = null

            // 2. Server-side availability check
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

            // 3. Final price
            const finalPrice = appliedCoupon ? (
                appliedCoupon.discount_type === 'percentage'
                    ? selectedService.price * (1 - appliedCoupon.discount_value / 100)
                    : Math.max(0, selectedService.price - appliedCoupon.discount_value)
            ) : selectedService.price

            // 4. Create the appointment (works for logged in users OR guest users)
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: business.id,
                    client_id: clientId,
                    guest_name: form.name,
                    guest_email: form.email,
                    guest_phone: formattedPhone,
                    team_member_id: selectedProfessional?.id || null,
                    service_name: selectedService.name,
                    date: selectedDate,
                    time: selectedTime,
                    duration: selectedService.duration,
                    price: finalPrice,
                    notes: form.note?.trim() || null,
                    send_emails: true,
                    coupon_id: appliedCoupon?.id || null,
                }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (res.status === 409) {
                    setError('Este horario ya fue reservado. Elegi otro horario.')
                } else if (res.status === 401) {
                    setError('Tu sesion expiro. Iniciá sesion para reservar.')
                } else {
                    setError(data?.error || 'Error al reservar el turno. Intenta de nuevo.')
                }
                setSubmitting(false)
                return
            }

            if (typeof window !== 'undefined') {
                if (form.name) localStorage.setItem('glowup_guest_name', form.name)
                if (form.email) localStorage.setItem('glowup_guest_email', form.email)
                if (formattedPhone) localStorage.setItem('glowup_guest_phone', formattedPhone)
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
