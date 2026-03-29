'use client'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import NotificationBell from '@/components/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { isSuperAdmin } from '@/lib/superadmin'
import styles from './layout.module.css'

export default function DashboardLayout({ children }) {
    const { user, loading, profile, business, createBusiness } = useAuth()
    const router = useRouter()
    const creatingBusinessRef = useRef(false)

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login')
        }
    }, [user, loading, router])

    // Auto-create business for superadmin if needed
    useEffect(() => {
        if (loading || !user || business || creatingBusinessRef.current) return

        // Wait for profile to load before making routing decisions
        if (!profile) return

        if (isSuperAdmin(user.email)) {
            creatingBusinessRef.current = true
            createBusiness({
                name: 'GLOWUP',
                business_type: 'barberia',
                phone: '',
                address: '',
                services: [
                    { name: 'Corte Clásico', price: 2500, duration: 30 },
                    { name: 'Corte + Barba', price: 4000, duration: 50 },
                    { name: 'Barba', price: 2000, duration: 20 },
                ],
                roles: ['Dueño', 'Admin', 'Barbero', 'Recepcionista'],
                settings: {
                    work_hours: { start: '09:00', end: '20:00' },
                    work_days: [1, 2, 3, 4, 5, 6],
                    slot_duration: 30,
                }
            }).catch(err => {
                console.error('Auto-create business error:', err)
                creatingBusinessRef.current = false
            })
        } else if (profile.role === 'user') {
            // Client users don't belong in dashboard
            router.replace('/book')
        } else if (!profile.business_id) {
            // Business user without business (pending_business) → onboarding
            router.replace('/onboarding')
        }
    }, [user, business, profile, loading, router, createBusiness])

    if (loading) {
        return (
            <div className={styles.loadingScreen}>
                <div className="loading-spinner" />
            </div>
        )
    }

    if (!user) return null

    return (
        <div className={styles.dashboardLayout}>
            <Sidebar />
            <main className={styles.mainContent}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
                    <NotificationBell />
                </div>
                {children}
            </main>
            <MobileNav />
        </div>
    )
}
