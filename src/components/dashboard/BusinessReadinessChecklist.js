'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Circle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hasConfiguredHours } from '@/lib/business-profile'
import styles from './BusinessReadinessChecklist.module.css'

export default function BusinessReadinessChecklist({ business }) {
    const [activeServices, setActiveServices] = useState(null)

    useEffect(() => {
        if (!business?.id || !supabase) return
        let active = true
        supabase.from('services')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', business.id)
            .eq('active', true)
            .then(({ count, error }) => {
                if (!active) return
                setActiveServices(error ? 0 : count || 0)
            })
        return () => { active = false }
    }, [business?.id])

    const items = useMemo(() => [
        {
            label: 'Dirección del local',
            detail: 'Hace que te encuentren y puedan abrir el mapa.',
            complete: Boolean(business?.address?.trim()),
            href: '/dashboard/settings#business-profile',
        },
        {
            label: 'Foto de portada',
            detail: 'Mejora la ficha, el buscador y el flyer.',
            complete: Boolean(business?.cover_image_url),
            href: '/dashboard/settings#business-photos',
        },
        {
            label: 'Servicios publicados',
            detail: activeServices === null ? 'Revisando el catálogo…' : `${activeServices} activo${activeServices === 1 ? '' : 's'}.`,
            complete: (activeServices || 0) > 0,
            href: '/dashboard/services',
        },
        {
            label: 'Horarios de atención',
            detail: 'Define cuándo aparecen turnos disponibles.',
            complete: hasConfiguredHours(business?.settings),
            href: '/dashboard/settings#business-hours',
        },
    ], [business, activeServices])

    const completed = items.filter(item => item.complete).length
    const percentage = Math.round((completed / items.length) * 100)

    return (
        <section className={`${styles.card} ${completed === items.length ? styles.complete : ''}`} aria-labelledby="readiness-title">
            <div className={styles.header}>
                <div>
                    <span className={styles.eyebrow}>Tu perfil público</span>
                    <h2 id="readiness-title">{completed === items.length ? 'Listo para recibir reservas' : 'Completá tu negocio'}</h2>
                    <p>{completed} de {items.length} datos clave listos</p>
                </div>
                <strong className={styles.percentage}>{percentage}%</strong>
            </div>
            <div className={styles.progress} aria-label={`${percentage}% completado`}>
                <span style={{ width: `${percentage}%` }} />
            </div>
            <div className={styles.items}>
                {items.map(item => (
                    <Link key={item.label} href={item.href} className={`${styles.item} ${item.complete ? styles.itemComplete : ''}`}>
                        {item.complete ? <Check size={18} /> : <Circle size={18} />}
                        <span>
                            <strong>{item.label}</strong>
                            <small>{item.detail}</small>
                        </span>
                        <ArrowRight size={16} />
                    </Link>
                ))}
            </div>
        </section>
    )
}
