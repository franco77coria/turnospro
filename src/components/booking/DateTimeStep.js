'use client'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Bell, Sun, Sunset, Moon } from 'lucide-react'
import styles from './DateTimeStep.module.css'
import WaitlistForm from './WaitlistForm'
import { todayLocal } from '@/lib/scheduling'

function groupSlotsByPeriod(slots) {
    const morning = [] // < 12:00
    const afternoon = [] // 12:00 - 18:00
    const evening = [] // >= 18:00

    for (const item of slots) {
        const timeStr = typeof item === 'string' ? item : item.time
        const hour = parseInt(timeStr.split(':')[0], 10)
        if (hour < 12) morning.push(item)
        else if (hour < 18) afternoon.push(item)
        else evening.push(item)
    }

    return [
        { id: 'morning', label: 'Mañana', icon: Sun, slots: morning },
        { id: 'afternoon', label: 'Tarde', icon: Sunset, slots: afternoon },
        { id: 'evening', label: 'Noche', icon: Moon, slots: evening },
    ].filter(g => g.slots.length > 0)
}

export default function DateTimeStep({
    dates,
    slots,
    selectedDate,
    selectedTime,
    loadingSlots,
    slotsError,
    onRetrySlots,
    hasTeamMembers,
    onSelectDate,
    onSelectTime,
    onContinue,
    onBack,
    businessId,
    teamMemberId,
    serviceName,
}) {
    const [showWaitlist, setShowWaitlist] = useState(false)
    const scrollRef = useRef(null)
    const selectedRef = useRef(null)

    // Auto-scroll to selected date
    useEffect(() => {
        if (selectedRef.current && scrollRef.current) {
            const container = scrollRef.current
            const el = selectedRef.current
            const scrollLeft = container.scrollLeft + el.getBoundingClientRect().left - container.getBoundingClientRect().left - (container.clientWidth - el.clientWidth) / 2
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
        }
    }, [selectedDate])

    const scroll = (dir) => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: dir * 200, behavior: 'smooth' })
        }
    }

    const availableSlots = slots.filter(s => typeof s === 'string' || s.available)
    const occupiedSlots = slots.filter(s => typeof s !== 'string' && !s.available)
    const groups = groupSlotsByPeriod(availableSlots)
    const hasAnyAvailable = availableSlots.length > 0

    // Parse selected date for display
    const selectedDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : null
    const selectedDateDisplay = selectedDateObj
        ? selectedDateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        : ''

    return (
        <div className={styles.container}>
            <button className={styles.backBtn} onClick={onBack}>
                <ArrowLeft size={14} /> {hasTeamMembers ? 'Cambiar profesional' : 'Cambiar servicio'}
            </button>

            <h2 className={styles.title}>Elegí fecha y hora</h2>

            {/* Date strip */}
            <div className={styles.dateSection}>
                <button className={styles.scrollBtn} onClick={() => scroll(-1)} aria-label="Anterior">
                    <ChevronLeft size={18} />
                </button>
                <div className={styles.dateStrip} ref={scrollRef}>
                    {dates.map(d => {
                        const dateObj = new Date(d.value + 'T12:00:00')
                        const dayNum = dateObj.getDate()
                        const dayName = dateObj.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')
                        const monthName = dateObj.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')
                        const isSelected = selectedDate === d.value
                        const isToday = d.value === todayLocal()

                        return (
                            <button
                                key={d.value}
                                ref={isSelected ? selectedRef : null}
                                className={`${styles.dateCard} ${isSelected ? styles.dateSelected : ''} ${isToday ? styles.dateToday : ''}`}
                                onClick={() => onSelectDate(d.value)}
                            >
                                <span className={styles.dateDayName}>{dayName}</span>
                                <span className={styles.dateDayNum}>{dayNum}</span>
                                <span className={styles.dateMonth}>{monthName}</span>
                            </button>
                        )
                    })}
                </div>
                <button className={styles.scrollBtn} onClick={() => scroll(1)} aria-label="Siguiente">
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Selected date label */}
            {selectedDate && (
                <p className={styles.selectedLabel}>{selectedDateDisplay}</p>
            )}

            {/* Time slots */}
            {selectedDate && (
                <div className={styles.timeSection}>
                    {loadingSlots ? (
                        <div className={styles.loadingWrap}>
                            <div className="loading-spinner" />
                        </div>
                    ) : slotsError ? (
                        <div className={styles.emptySlots} role="alert">
                            <p>{slotsError}</p>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetrySlots}>Reintentar</button>
                        </div>
                    ) : slots.length === 0 ? (
                        <div className={styles.emptySlots}>
                            <p>No hay horarios disponibles para esta fecha.</p>
                            {!showWaitlist ? (
                                <button className={styles.waitlistBtn} onClick={() => setShowWaitlist(true)}>
                                    <Bell size={14} /> Avisarme si se libera
                                </button>
                            ) : (
                                <WaitlistForm
                                    businessId={businessId}
                                    date={selectedDate}
                                    teamMemberId={teamMemberId}
                                    serviceName={serviceName}
                                    onClose={() => setShowWaitlist(false)}
                                />
                            )}
                        </div>
                    ) : (
                        <div className={styles.timeGroups}>
                            {!hasAnyAvailable && (
                                <div className={styles.allOccupiedNotice}>
                                    <p>Todos los horarios de esta fecha ya están reservados.</p>
                                    {!showWaitlist ? (
                                        <button className={styles.waitlistBtn} onClick={() => setShowWaitlist(true)}>
                                            <Bell size={14} /> Avisarme si se libera un turno
                                        </button>
                                    ) : (
                                        <WaitlistForm
                                            businessId={businessId}
                                            date={selectedDate}
                                            teamMemberId={teamMemberId}
                                            serviceName={serviceName}
                                            onClose={() => setShowWaitlist(false)}
                                        />
                                    )}
                                </div>
                            )}

                            {hasAnyAvailable && <p className={styles.availableIntro}>{availableSlots.length} {availableSlots.length === 1 ? 'horario libre' : 'horarios libres'} para elegir</p>}
                            {groups.map(group => {
                                const Icon = group.icon
                                const availableCount = group.slots.length
                                return (
                                    <div key={group.id} className={styles.timeGroup}>
                                        <div className={styles.groupHeader}>
                                            <Icon size={14} />
                                            <span>{group.label}</span>
                                            <span className={styles.groupCount}>
                                                {availableCount > 0 ? `${availableCount} libre${availableCount > 1 ? 's' : ''}` : 'Sin libres'}
                                            </span>
                                        </div>
                                        <div className={styles.timeGrid}>
                                            {group.slots.map(slot => {
                                                const timeStr = typeof slot === 'string' ? slot : slot.time
                                                const isSelected = selectedTime === timeStr

                                                return (
                                                    <button
                                                        key={timeStr}
                                                        type="button"
                                                        className={`
                                                            ${styles.timeChip} 
                                                            ${isSelected ? styles.timeSelected : ''} 
                                                        `}
                                                        onClick={() => onSelectTime(timeStr)}
                                                        title={`Reservar a las ${timeStr}`}
                                                    >
                                                        <span className={styles.timeText}>{timeStr}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                            {occupiedSlots.length > 0 && (
                                <details key={selectedDate} className={styles.occupiedDetails}>
                                    <summary>Ver {occupiedSlots.length} {occupiedSlots.length === 1 ? 'horario ocupado' : 'horarios ocupados'}</summary>
                                    <div className={styles.timeGrid}>
                                        {occupiedSlots.map(slot => (
                                            <span key={slot.time} className={`${styles.timeChip} ${styles.timeOccupied}`} title={`${slot.time} - Ocupado`}>
                                                <span className={styles.timeText}>{slot.time}</span>
                                                <span className={styles.occupiedLabel}>Ocupado</span>
                                            </span>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Continue button */}
            {selectedDate && selectedTime && (
                <button className={styles.continueBtn} onClick={onContinue}>
                    Continuar <ArrowRight size={16} />
                </button>
            )}
        </div>
    )
}
