import { Check } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

/**
 * Cuando el negocio no tiene equipo cargado, el flujo saltea el paso 2 y usa
 * los valores 1, 3 y 4. El stepper comparaba contra 1, 2 y 3, así que en
 * "Fecha y hora" marcaba "Confirmar" como paso actual.
 */
export default function ProgressStepper({ step, teamMembers, onStepClick }) {
    const hasTeam = teamMembers.length > 0
    const steps = hasTeam
        ? [
            { value: 1, label: 'Servicio' },
            { value: 2, label: 'Profesional' },
            { value: 3, label: 'Fecha y hora' },
            { value: 4, label: 'Confirmar' },
        ]
        : [
            { value: 1, label: 'Servicio' },
            { value: 3, label: 'Fecha y hora' },
            { value: 4, label: 'Confirmar' },
        ]

    return (
        <div className={styles.progress}>
            {steps.map((s, idx) => {
                const done = step > s.value
                const current = step === s.value
                // Los pasos ya completados son otra forma de volver atrás
                const clickable = done && typeof onStepClick === 'function'
                const Tag = clickable ? 'button' : 'div'
                return (
                    <Tag
                        key={s.value}
                        type={clickable ? 'button' : undefined}
                        onClick={clickable ? () => onStepClick(s.value) : undefined}
                        className={`${styles.progressStep} ${done || current ? styles.progressActive : ''} ${clickable ? styles.progressClickable : ''}`}
                        aria-current={current ? 'step' : undefined}
                        aria-label={clickable ? `Volver a ${s.label}` : undefined}
                    >
                        <div className={styles.progressDot}>{done ? <Check size={12} /> : idx + 1}</div>
                        <span>{s.label}</span>
                    </Tag>
                )
            })}
        </div>
    )
}
