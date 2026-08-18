'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Bell, X, CalendarDays, CalendarX, Check } from 'lucide-react'

export default function NotificationBell() {
    const { user, business } = useAuth()
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    // Se extrae el id: así la dependencia declarada coincide exactamente con lo
    // que el cuerpo lee, y el compilador de React puede optimizar el componente.
    const userId = user?.id

    // Sin useCallback esta función cambia de identidad en cada render, y está
    // en las dependencias del efecto de abajo: cada fetch dispara un setState,
    // que dispara un render, que dispara otro fetch. Bucle infinito contra la
    // base y resuscripción constante del canal de realtime.
    const loadNotifications = useCallback(async () => {
        if (!supabase || !userId) return
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)
        setNotifications(data || [])
        setUnreadCount((data || []).filter(n => !n.read).length)
    }, [userId])

    useEffect(() => {
        loadNotifications()

        // Subscribe to realtime notifications
        if (!supabase || !userId) return
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev])
                setUnreadCount(prev => prev + 1)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userId, loadNotifications])

    async function markAllRead() {
        if (!supabase || !user?.id) return
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
    }

    const iconForType = (type) => {
        if (type === 'appointment_booked') return CalendarDays
        if (type === 'appointment_cancelled') return CalendarX
        return Bell
    }

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    position: 'relative', padding: 'var(--space-2)',
                    color: 'var(--text-secondary)',
                }}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--danger)', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'fixed', right: 'var(--space-2)', left: 'var(--space-2)', top: 'auto',
                        marginTop: 'var(--space-2)',
                        maxWidth: 380, marginLeft: 'auto',
                        maxHeight: '70vh', overflowY: 'auto',
                        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                        zIndex: 100,
                    }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Notificaciones</span>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 'var(--font-size-xs)', color: 'var(--accent)',
                                    }}>
                                        Marcar leídas
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {notifications.length === 0 ? (
                            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                                Sin notificaciones
                            </div>
                        ) : (
                            notifications.map(n => {
                                const Icon = iconForType(n.type)
                                return (
                                    <div key={n.id} style={{
                                        padding: 'var(--space-3) var(--space-4)',
                                        borderBottom: '1px solid var(--border)',
                                        background: n.read ? 'transparent' : 'var(--accent-light)',
                                        display: 'flex', gap: 'var(--space-3)',
                                    }}>
                                        <Icon size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: n.read ? 400 : 600 }}>
                                                {n.title}
                                            </div>
                                            {n.message && (
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                    {n.message}
                                                </div>
                                            )}
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                {timeAgo(n.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `Hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `Hace ${days}d`
}
