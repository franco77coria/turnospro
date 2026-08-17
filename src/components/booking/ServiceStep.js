import { Clock, ArrowRight, ArrowLeft } from 'lucide-react'
import styles from '@/app/book/[id]/booking.module.css'

export default function ServiceStep({ services, selectedService, onSelect, onContinue, backHref }) {
    return (
        <div className={styles.stepContent}>
            {/* Sin esto el wizard es una puerta de una sola dirección: quien
                entra desde la ficha no tiene forma de volver. */}
            {backHref && (
                <a className={styles.backBtn} href={backHref}>
                    <ArrowLeft size={14} /> Volver a la ficha
                </a>
            )}
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
                        {/* Sin locale, un navegador en inglés muestra 12,000
                            donde la ficha muestra 12.000: mismo número, dos
                            separadores, un solo flujo. */}
                        <span className={styles.servicePrice}>${s.price?.toLocaleString('es-AR')}</span>
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
