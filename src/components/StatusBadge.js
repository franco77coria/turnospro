'use client'
import { APPOINTMENT_STATUS } from '@/lib/data'

/**
 * Shared StatusBadge component for appointment status
 * Usage: <StatusBadge status="confirmed" />
 */
export default function StatusBadge({ status, showLabel = true }) {
    const s = Object.values(APPOINTMENT_STATUS).find(a => a.id === status)
    if (!s) return null
    return (
        <span className={`badge badge-${s.color}`}>
            {showLabel ? s.label : s.id}
        </span>
    )
}
