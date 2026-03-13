'use client'
import { useAuth } from '@/context/AuthContext'
import { hasPermission } from '@/lib/permissions'
import { ShieldX } from 'lucide-react'

export default function PermissionGate({ permission, children }) {
    const { profile, loading } = useAuth()

    if (loading) return null

    const userRole = profile?.role || 'Profesional'

    if (permission && !hasPermission(userRole, permission)) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-10)',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
            }}>
                <ShieldX size={40} style={{ color: 'var(--danger)' }} />
                <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Acceso restringido</h2>
                <p style={{ margin: 0, maxWidth: 400 }}>
                    No tenés permisos para acceder a esta sección. Contactá al dueño del negocio si creés que es un error.
                </p>
            </div>
        )
    }

    return children
}
