'use client'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import styles from './layout.module.css'

export default function DashboardLayout({ children }) {
    const { user, loading, business } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading, router])

    useEffect(() => {
        if (!loading && user && !business) {
            router.push('/onboarding')
        }
    }, [user, business, loading, router])

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
                {children}
            </main>
            <MobileNav />
        </div>
    )
}
