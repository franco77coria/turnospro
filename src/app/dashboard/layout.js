'use client'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isSuperAdmin } from '@/lib/superadmin'
import styles from './layout.module.css'

export default function DashboardLayout({ children }) {
    const { user, loading, profile, business, createBusiness } = useAuth()
    const router = useRouter()
    const creatingBusinessRef = useRef(false)
    const [timedOut, setTimedOut] = useState(false)

    // Safety timeout: if loading takes more than 8s, stop the spinner
    useEffect(() => {
        if (!loading) return
        const timer = setTimeout(() => setTimedOut(true), 8000)
        return () => clearTimeout(timer)
    }, [loading])

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading, router])

    useEffect(() => {
        if (!loading && user && !business && !creatingBusinessRef.current) {
            // Superadmin skips onboarding — auto-create a default business
            if (isSuperAdmin(user.email)) {
                creatingBusinessRef.current = true
                // First check if a business already exists for this user
                const checkAndCreate = async () => {
                    try {
                        const { supabase } = await import('@/lib/supabase')
                        if (!supabase) return

                        // Check if there's already a business
                        const { data: existing } = await supabase
                            .from('businesses')
                            .select('*')
                            .eq('owner_id', user.id)
                            .limit(1)
                            .single()

                        if (existing) {
                            // Business exists, just need to link profile
                            await supabase.from('profiles').update({ business_id: existing.id }).eq('id', user.id)
                            // Force refresh the auth context
                            window.location.reload()
                            return
                        }

                        // No business exists, create one
                        await createBusiness({
                            name: 'GLOWUP Admin',
                            business_type: 'barberia',
                            phone: '',
                            address: '',
                            services: [
                                { name: 'Corte Clásico', price: 2500, duration: 30 },
                                { name: 'Corte + Barba', price: 4000, duration: 50 },
                                { name: 'Barba', price: 2000, duration: 20 },
                            ],
                            roles: ['Dueño', 'Admin', 'Profesional', 'Recepcionista'],
                            settings: {
                                work_hours: { start: '09:00', end: '20:00' },
                                work_days: [1, 2, 3, 4, 5, 6],
                                slot_duration: 30,
                            }
                        })
                    } catch (err) {
                        console.error('Auto-create business error:', err)
                        creatingBusinessRef.current = false
                    }
                }
                checkAndCreate()
            } else {
                router.push('/onboarding')
            }
        }
    }, [user, business, loading, router, createBusiness])

    if (loading && !timedOut) {
        return (
            <div className={styles.loadingScreen}>
                <div className="loading-spinner" />
            </div>
        )
    }

    // If timed out, redirect to login instead of spinning forever
    if (timedOut && !user) {
        if (typeof window !== 'undefined') {
            router.push('/login')
        }
        return null
    }

    if (!user) return null

    return (
        <div className={styles.dashboardLayout}>
            <Sidebar />
            <main className={styles.mainContent}>
                {children}
            </main>
            <MobileNav />
        </div>
    )
}
