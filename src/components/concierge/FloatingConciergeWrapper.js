'use client'
import { usePathname } from 'next/navigation'
import ConciergeChat from './ConciergeChat'

export default function FloatingConciergeWrapper() {
    const path = usePathname()
    if (path !== '/' && path !== '/explore' && !path.startsWith('/explore/')) return null
    return <ConciergeChat />
}
