'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle } from 'lucide-react'
import styles from './ClientProfileCard.module.css'

export default function ClientProfileCard({ clientId, businessId }) {
    const [client, setClient] = useState(null)
    const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0 })

    const loadProfile = useCallback(async () => {
        if (!supabase) return

        const [{ data: clientData }, { data: apts }] = await Promise.all([
            supabase.from('clients').select('*').eq('id', clientId).single(),
            supabase.from('appointments')
                .select('status')
                .eq('client_id', clientId)
                .eq('business_id', businessId),
        ])

        if (clientData) setClient(clientData)
        if (apts) {
            setStats({
                total: apts.length,
                completed: apts.filter(a => a.status === 'completed').length,
                cancelled: apts.filter(a => a.status === 'cancelled').length,
            })
        }
    }, [clientId, businessId])

    useEffect(() => {
        if (clientId && businessId) loadProfile()
    }, [clientId, businessId, loadProfile])

    if (!client) return null

    const tags = Array.isArray(client.tags) ? client.tags : []
    const prefs = client.preferences && typeof client.preferences === 'object' ? client.preferences : {}
    const prefEntries = Object.entries(prefs).filter(([, v]) => v)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const monthlyCancels = client.last_cancellation_month === currentMonth ? (client.monthly_cancellations || 0) : 0

    return (
        <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
                <div className="avatar">{client.name?.[0]?.toUpperCase()}</div>
                <div>
                    <div className={styles.profileName}>{client.name}</div>
                    <div className={styles.profileContact}>
                        {client.phone && <span>{client.phone}</span>}
                        {client.phone && client.email && <span> · </span>}
                        {client.email && <span>{client.email}</span>}
                    </div>
                </div>
            </div>

            <div className={styles.profileStats}>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{stats.total}</span>
                    <span className={styles.statLabel}>Turnos</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{stats.completed}</span>
                    <span className={styles.statLabel}>Completados</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statValue}>{stats.cancelled}</span>
                    <span className={styles.statLabel}>Cancelados</span>
                </div>
            </div>

            {monthlyCancels >= 2 && (
                <div className={styles.cancelWarning}>
                    <AlertTriangle size={14} />
                    {monthlyCancels} cancelaciones este mes
                </div>
            )}

            {tags.length > 0 && (
                <div className={styles.tags}>
                    {tags.map(tag => (
                        <span key={tag} className="badge badge-accent">{tag}</span>
                    ))}
                </div>
            )}

            {prefEntries.length > 0 && (
                <div className={styles.preferences}>
                    {prefEntries.map(([key, val]) => (
                        <div key={key}>
                            <span className={styles.prefLabel}>{key}:</span>{val}
                        </div>
                    ))}
                </div>
            )}

            {client.notes && (
                <div className={styles.preferences}>
                    <span className={styles.prefLabel}>Notas:</span>{client.notes}
                </div>
            )}
        </div>
    )
}
