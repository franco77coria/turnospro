import { useState } from 'react'
import { Bell, User, Mail } from 'lucide-react'
import styles from './WaitlistForm.module.css'

export default function WaitlistForm({ businessId, date, teamMemberId, serviceName, onClose }) {
    const [form, setForm] = useState({ name: '', email: '' })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        setSubmitting(true)
        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: businessId,
                    date,
                    client_name: form.name,
                    client_email: form.email,
                    team_member_id: teamMemberId || null,
                    service_name: serviceName || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSuccess(true)
        } catch (err) {
            setError(err.message || 'Error al registrar')
        }
        setSubmitting(false)
    }

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.successMsg}>
                    <Bell size={20} />
                    <div>
                        <strong>Te avisaremos</strong>
                        <p>Si se libera un turno te avisaremos por email.</p>
                    </div>
                </div>
                {onClose && (
                    <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: 'var(--space-2)' }}>
                        Cerrar
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <p className={styles.title}>
                <Bell size={16} /> Avisarme si se libera un turno
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                    <div className={styles.inputIcon}><User size={14} /></div>
                    <input className="input" placeholder="Tu nombre" value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className={styles.field}>
                    <div className={styles.inputIcon}><Mail size={14} /></div>
                    <input className="input" type="email" placeholder="tu@email.com" value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.actions}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                        {submitting ? <div className="loading-spinner" /> : 'Notificarme'}
                    </button>
                    {onClose && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
                    )}
                </div>
            </form>
        </div>
    )
}
