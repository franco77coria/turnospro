import { Check } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

export default function ProgressStepper({ step, teamMembers }) {
    const steps = teamMembers.length > 0 ? [1, 2, 3, 4] : [1, 2, 3]
    const labels = teamMembers.length > 0
        ? ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar']
        : ['Servicio', 'Fecha y hora', 'Confirmar']

    return (
        <div className={styles.progress}>
            {steps.map((s, idx) => (
                <div key={s} className={`${styles.progressStep} ${step >= s ? styles.progressActive : ''}`}>
                    <div className={styles.progressDot}>{step > s ? <Check size={12} /> : idx + 1}</div>
                    <span>{labels[idx]}</span>
                </div>
            ))}
        </div>
    )
}
