'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { BUSINESS_TEMPLATES } from '@/lib/data'
import { Scissors, Sparkles, Hand, Eye, Heart, Stethoscope, PawPrint, Wrench, ArrowLeft } from 'lucide-react'
import styles from './onboarding.module.css'

const RUBRO_ICONS = {
    barberia: Scissors,
    peluqueria: Scissors,
    unas: Hand,
    lash: Eye,
    spa: Sparkles,
    consultorio: Stethoscope,
    veterinaria: PawPrint,
    custom: Wrench,
}

export default function OnboardingPage() {
    const { user, createBusiness } = useAuth()
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: '',
        business_type: '',
        phone: '',
        address: '',
    })

    function slugify(text) {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40)
    }

    const handleSelectType = (type) => {
        setForm(prev => ({ ...prev, business_type: type }))
        setStep(2)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.name || !form.business_type) return

        setLoading(true)
        try {
            const template = BUSINESS_TEMPLATES[form.business_type]
            // Add unique IDs to each template service
            const servicesWithIds = template.services.map(s => ({ ...s, id: crypto.randomUUID() }))
            const slug = slugify(form.name) + '-' + Date.now().toString(36).slice(-4)
            await createBusiness({
                name: form.name,
                business_type: form.business_type,
                phone: form.phone,
                address: form.address,
                slug,
                services: servicesWithIds,
                roles: template.roles,
                settings: {
                    work_hours: { start: '09:00', end: '20:00' },
                    work_days: [1, 2, 3, 4, 5, 6],
                    slot_duration: 30,
                    min_cancel_hours: 2,
                }
            })
            router.push('/dashboard')
        } catch (err) {
            console.error('Error creating business:', err)
            setLoading(false)
        }
    }

    return (
        <div className={styles.onboarding}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <span className={styles.logoMark}>T</span>
                    <h1>{step === 1 ? '¿Cuál es tu rubro?' : 'Datos de tu negocio'}</h1>
                    <p>{step === 1 ? 'Elegí tu rubro para personalizar todo automáticamente.' : 'Completá la información básica para empezar.'}</p>
                </div>

                {step === 1 ? (
                    <div className={styles.typeGrid}>
                        {Object.entries(BUSINESS_TEMPLATES).map(([key, template]) => {
                            const Icon = RUBRO_ICONS[key] || Wrench
                            return (
                                <button
                                    key={key}
                                    className={`${styles.typeCard} ${form.business_type === key ? styles.typeSelected : ''}`}
                                    onClick={() => handleSelectType(key)}
                                >
                                    <Icon size={24} className={styles.typeIcon} />
                                    <span className={styles.typeName}>{template.name}</span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.selectedType}>
                            {(() => { const Icon = RUBRO_ICONS[form.business_type] || Wrench; return <Icon size={18} /> })()}
                            <span>{BUSINESS_TEMPLATES[form.business_type].name}</span>
                            <button type="button" className={styles.changeBtn} onClick={() => setStep(1)}>
                                <ArrowLeft size={12} /> Cambiar
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="label">Nombre del negocio *</label>
                            <input
                                className="input"
                                placeholder="Ej: Barbería El Patrón"
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Teléfono</label>
                            <input
                                className="input"
                                placeholder="Ej: +54 11 1234-5678"
                                value={form.phone}
                                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Dirección</label>
                            <input
                                className="input"
                                placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                                value={form.address}
                                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || !form.name}>
                            {loading ? <div className="loading-spinner" /> : 'Crear mi negocio'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
