'use client'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import styles from '../app/page.module.css'

export default function NavAuth() {
    const { user } = useAuth()

    return (
        <>
            {user ? (
                <Link href="/dashboard" className="btn btn-primary">Mi Dashboard</Link>
            ) : (
                <Link href="/login" className="btn btn-primary">Ingresar</Link>
            )}
        </>
    )
}

export function CTAButton() {
    const { user } = useAuth()
    return (
        <Link href={user ? '/dashboard' : '/login'} className="btn btn-primary btn-lg">
            {user ? 'Ir al Dashboard' : 'Empezar gratis'} →
        </Link>
    )
}
