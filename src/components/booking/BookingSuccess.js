import { Check, CalendarDays, Download } from 'lucide-react'
import { googleCalendarUrl, generateICS, downloadICS } from '@/lib/calendar-export'
import styles from '@/app/book/[id]/booking.module.css'

export default function BookingSuccess({
    selectedService,
    selectedDate,
    selectedTime,
    business,
    onReset,
}) {
    const dateObj = new Date(selectedDate)

    return (
        <div className={styles.bookingPage}>
            <div className={styles.container}>
                <div className={styles.successCard}>
                    <div className={styles.successIcon}>
                        <Check size={32} />
                    </div>
                    <h1>Turno reservado</h1>
                    <p>Tu turno fue agendado exitosamente. Te enviamos un email de confirmacion.</p>

                    <div className={styles.summaryCard}>
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Servicio</span>
                            <span className={styles.summaryValue}>{selectedService.name}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Fecha</span>
                            <span className={styles.summaryValue}>
                                {dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Hora</span>
                            <span className={styles.summaryValue}>{selectedTime}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Negocio</span>
                            <span className={styles.summaryValue}>{business.name}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <a
                            href={googleCalendarUrl({
                                serviceName: selectedService.name,
                                date: selectedDate,
                                time: selectedTime,
                                duration: selectedService.duration,
                                businessName: business.name,
                                address: business.address,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: 180, textAlign: 'center', textDecoration: 'none' }}
                        >
                            <CalendarDays size={14} /> Google Calendar
                        </a>
                        <button
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: 180 }}
                            onClick={() => {
                                const ics = generateICS({
                                    serviceName: selectedService.name,
                                    date: selectedDate,
                                    time: selectedTime,
                                    duration: selectedService.duration,
                                    businessName: business.name,
                                    address: business.address,
                                })
                                downloadICS(ics)
                            }}
                        >
                            <Download size={14} /> Descargar .ics
                        </button>
                    </div>

                    <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-3)' }}
                        onClick={onReset}>
                        Reservar otro turno
                    </button>
                </div>
            </div>
        </div>
    )
}
