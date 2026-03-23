import { Clock, ArrowRight } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

export default function ServiceStep({ services, selectedService, onSelect, onContinue }) {
    return (
        <div className={styles.stepContent}>
            <h2>Elegi un servicio</h2>
            <div className={styles.serviceList}>
                {services.map((s, i) => (
                    <button
                        key={i}
                        className={`${styles.serviceItem} ${selectedService?.name === s.name ? styles.selected : ''}`}
                        onClick={() => onSelect(s)}
                    >
                        <div>
                            <span className={styles.serviceName}>{s.name}</span>
                            <span className={styles.serviceMeta}>
                                <Clock size={12} /> {s.duration} min
                            </span>
                        </div>
                        <span className={styles.servicePrice}>${s.price?.toLocaleString()}</span>
                    </button>
                ))}
            </div>
            {selectedService && (
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-4)' }}
                    onClick={onContinue}>
                    Continuar <ArrowRight size={16} />
                </button>
            )}
        </div>
    )
}
