import { ArrowLeft, ArrowRight } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

export default function DateTimeStep({
    dates,
    slots,
    selectedDate,
    selectedTime,
    loadingSlots,
    hasTeamMembers,
    onSelectDate,
    onSelectTime,
    onContinue,
    onBack,
}) {
    return (
        <div className={styles.stepContent}>
            <button className={styles.backBtn} onClick={onBack}>
                <ArrowLeft size={14} /> {hasTeamMembers ? 'Cambiar profesional' : 'Cambiar servicio'}
            </button>
            <h2>Elegi fecha y hora</h2>

            <h3 className={styles.subLabel}>Fecha</h3>
            <div className={styles.dateGrid}>
                {dates.map(d => (
                    <button
                        key={d.value}
                        className={`${styles.dateBtn} ${selectedDate === d.value ? styles.selected : ''}`}
                        onClick={() => onSelectDate(d.value)}
                    >
                        {d.label}
                    </button>
                ))}
            </div>

            {selectedDate && (
                <>
                    <h3 className={styles.subLabel}>Hora</h3>
                    {loadingSlots ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}>
                            <div className="loading-spinner" />
                        </div>
                    ) : slots.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>
                            No hay horarios disponibles para esta fecha. Proba con otro dia.
                        </p>
                    ) : (
                        <div className={styles.timeGrid}>
                            {slots.map(t => (
                                <button
                                    key={t}
                                    className={`${styles.timeBtn} ${selectedTime === t ? styles.selected : ''}`}
                                    onClick={() => onSelectTime(t)}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {selectedDate && selectedTime && (
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
                    onClick={onContinue}>
                    Continuar <ArrowRight size={16} />
                </button>
            )}
        </div>
    )
}
