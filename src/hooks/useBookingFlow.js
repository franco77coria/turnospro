'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { validateInternationalPhone } from '@/lib/phone-validation'
import { loadBusinessServices } from '@/lib/services'
import {
    DEFAULT_DURATION,
    formatDateLocal,
    generateAvailableSlots,
    resolveScheduleSettings,
    todayLocal,
    toOccupiedRanges,
} from '@/lib/scheduling'

export function useBookingFlow() {
    const { id } = useParams()
    // La ficha manda ?service={id}: sin esto el usuario ya había elegido y el
    // wizard le pedía elegir de nuevo, justo en el momento de mayor intención.
    const preselectedServiceId = useSearchParams().get('service')
    const { user, loading: authLoading } = useAuth()
    const [business, setBusiness] = useState(null)
    const [loading, setLoading] = useState(true)
    const [step, setStepState] = useState(1)
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

    // Los pasos viven en el historial del navegador. Sin esto, "atrás" saca al
    // usuario del flujo entero en vez de retroceder un paso — y en el navegador
    // embebido de Instagram eso cierra la sesión de compra.
    const stepRef = useRef(1)
    useEffect(() => { stepRef.current = step }, [step])

    const setStep = useCallback((value, { replace = false } = {}) => {
        if (value === stepRef.current) return
        stepRef.current = value
        setStepState(value)
        if (typeof window === 'undefined') return
        const entry = { bookingStep: value }
        if (replace) window.history.replaceState(entry, '')
        else window.history.pushState(entry, '')
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        // La entrada inicial se marca sin apilar: "atrás" desde el paso 1 tiene
        // que devolver a la ficha, no dejar al usuario encerrado.
        window.history.replaceState({ bookingStep: stepRef.current }, '')
        function onPop(event) {
            const target = event.state?.bookingStep
            if (typeof target !== 'number') return
            stepRef.current = target
            setStepState(target)
        }
        window.addEventListener('popstate', onPop)
        return () => window.removeEventListener('popstate', onPop)
    }, [])

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
                .gte('date', todayLocal())
            setClosureDates((closures || []).map(c => c.date))

            // Load team absences
            const { data: absences } = await supabase
                .from('team_absences')
                .select('team_member_id, start_date, end_date')
                .eq('business_id', data.id)
                .gte('end_date', todayLocal())
            setTeamAbsences(absences || [])

            // Servicios desde la fuente única (tabla `services`, con fallback al JSONB)
            setServicesList(await loadBusinessServices(supabase, data.id, { activeOnly: true }))
        }
        setLoading(false)
    }, [id])

    useEffect(() => {
        loadBusiness()
    }, [loadBusiness])

    // Preselección del servicio que venía desde la ficha
    useEffect(() => {
        if (!preselectedServiceId || selectedService || servicesList.length === 0) return
        const match = servicesList.find(s => String(s.id) === String(preselectedServiceId))
        if (!match) return
        setSelectedService(match)
        setStep(teamMembers.length > 0 ? 2 : 3, { replace: true })
    }, [preselectedServiceId, servicesList, teamMembers.length, selectedService, setStep])

    // Load occupied slots when date changes
    useEffect(() => {
        if (!selectedDate || !business?.id || !supabase) return
        setLoadingSlots(true)
        setSelectedTime('')
        const tmId = selectedProfessional?.id
        // `public_busy_slots`, no `appointments`: RLS no deja que un invitado lea
        // la tabla, así que la consulta devolvía cero filas y TODOS los horarios
        // aparecían libres. La vista expone solo hora y duración, sin datos del cliente.
        let query = supabase
            .from('public_busy_slots')
            .select('time, duration, team_member_id')
            .eq('business_id', business.id)
            .eq('date', selectedDate)
        // Filter by professional if one is selected
        if (tmId) query = query.eq('team_member_id', tmId)
        query.then(({ data, error }) => {
            if (error) {
                // Si la vista todavía no existe (migración sin aplicar), es mejor
                // gritarlo que mostrar en silencio la agenda entera como libre.
                console.error('[Booking] No se pudieron leer los horarios ocupados:', error.message)
            }
            setOccupiedSlots(toOccupiedRanges(data))
            setLoadingSlots(false)
        })
    }, [selectedDate, business?.id, selectedProfessional?.id])

    // Horarios disponibles — misma implementación que usa el dashboard
    function getTimeSlots() {
        if (!business) return []
        return generateAvailableSlots({
            settings: business.settings,
            duration: selectedService?.duration || DEFAULT_DURATION,
            occupied: occupiedSlots,
            date: selectedDate,
            enforceMinAdvance: true,
        })
    }

    // Generate available dates (respecting max advance, work days, closed dates, and absences)
    function getAvailableDates() {
        const dates = []
        const { workDays, maxAdvanceDays: maxDays } = resolveScheduleSettings(business?.settings)
        // Merge JSONB closed_dates with business_closures table
        const settingsClosedDates = (business?.settings?.closed_dates || []).map(cd => cd.date)
        const allClosedDates = [...new Set([...settingsClosedDates, ...closureDates])]

        for (let i = 0; i <= maxDays; i++) {
            const d = new Date()
            d.setDate(d.getDate() + i)
            const dateStr = formatDateLocal(d)

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
            // Mandamos el profesional y el buffer: sin eso el servidor comparaba
            // contra la agenda de todo el negocio e ignoraba el descanso configurado.
            const checkRes = await fetch('/api/appointments/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: business.id,
                    date: selectedDate,
                    time: selectedTime,
                    duration: selectedService.duration || DEFAULT_DURATION,
                    team_member_id: selectedProfessional?.id || null,
                    buffer_time: resolveScheduleSettings(business.settings).bufferTime,
                }),
            })
            const checkData = await checkRes.json()
            if (!checkData.available) {
                setError(checkData.reason || 'Este horario ya fue reservado. Elegí otro horario.')
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
                    duration: selectedService.duration || DEFAULT_DURATION,
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

    // loadBusinessServices ya resuelve el fallback al JSONB heredado y normaliza
    // la forma, así que acá no hace falta un segundo fallback sin normalizar.
    const services = servicesList
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
