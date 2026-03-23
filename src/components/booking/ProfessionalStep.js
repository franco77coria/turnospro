import { ArrowLeft } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

export default function ProfessionalStep({ teamMembers, selectedProfessional, onSelect, onBack }) {
    return (
        <div className={styles.stepContent}>
            <button className={styles.backBtn} onClick={onBack}>
                <ArrowLeft size={14} /> Cambiar servicio
            </button>
            <h2>Elegi un profesional</h2>
            <div className={styles.serviceList}>
                <button
                    className={`${styles.serviceItem} ${selectedProfessional === null ? styles.selected : ''}`}
                    onClick={() => onSelect(null)}
                >
                    <div>
                        <span className={styles.serviceName}>Sin preferencia</span>
                        <span className={styles.serviceMeta}>Primer horario disponible</span>
                    </div>
                </button>
                {teamMembers.map(tm => (
                    <button
                        key={tm.id}
                        className={`${styles.serviceItem} ${selectedProfessional?.id === tm.id ? styles.selected : ''}`}
                        onClick={() => onSelect(tm)}
                    >
                        <div>
                            <span className={styles.serviceName}>{tm.name}</span>
                            <span className={styles.serviceMeta}>{tm.role || 'Profesional'}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}
