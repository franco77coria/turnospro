'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { isSuperAdmin } from '@/lib/superadmin'
import { RUBRO_DEMOS, RUBRO_LIST } from '@/lib/demo-data'
import { Scissors, Sparkles, Hand, Eye, Heart, Stethoscope, PawPrint, CalendarDays, Users, DollarSign, Clock, ChevronRight } from 'lucide-react'
import styles from './demo.module.css'

const RUBRO_ICONS = {
    barberia: Scissors,
    peluqueria: Sparkles,
    unas: Hand,
    lash: Eye,
    spa: Heart,
    consultorio: Stethoscope,
    veterinaria: PawPrint,
}

export default function DemoPage() {
    const { user } = useAuth()
    const [selectedRubro, setSelectedRubro] = useState(null)

    if (!user || !isSuperAdmin(user.email)) {
        return <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-secondary)' }}>No tenés permisos.</div>
    }

    const demo = selectedRubro ? RUBRO_DEMOS[selectedRubro] : null

    return (
        <div className={styles.demoPage}>
            <div className={styles.header}>
                <div>
                    <h1>Modo Demo</h1>
                    <p className={styles.subtitle}>Visualizá cómo se ve el dashboard para cada rubro</p>
                </div>
            </div>

            {/* Rubro selector */}
            <div className={styles.rubroGrid}>
                {RUBRO_LIST.map(rubro => {
                    const Icon = RUBRO_ICONS[rubro.key] || Scissors
                    return (
                        <button
                            key={rubro.key}
                            className={`${styles.rubroCard} ${selectedRubro === rubro.key ? styles.selected : ''}`}
                            onClick={() => setSelectedRubro(rubro.key)}
                        >
                            <Icon size={20} />
                            <span>{rubro.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Demo preview */}
            {demo && (
                <div className={styles.preview}>
                    <div className={styles.previewHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2>{demo.name}</h2>
                            <span className="badge badge-accent">{RUBRO_LIST.find(r => r.key === selectedRubro)?.label}</span>
                        </div>
                        <button className="btn btn-primary" onClick={() => alert('Estás en el Modo Demo (solo visualización). Para crear un turno real, andá a "Calendario" o "Turnos" en el menú lateral de tu negocio.')}>
                            + Nuevo turno
                        </button>
                    </div>

                    {/* Stats */}
                    <div className={styles.statsGrid}>
                        <div className="card card-compact stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
                                <span className="stat-label">Turnos del mes</span>
                            </div>
                            <span className="stat-value">{demo.stats.turnos}</span>
                        </div>
                        <div className="card card-compact stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <DollarSign size={16} style={{ color: 'var(--success)' }} />
                                <span className="stat-label">Ingresos</span>
                            </div>
                            <span className="stat-value">${demo.stats.ingresos.toLocaleString()}</span>
                        </div>
                        <div className="card card-compact stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <Users size={16} style={{ color: 'var(--info)' }} />
                                <span className="stat-label">Clientes</span>
                            </div>
                            <span className="stat-value">{demo.stats.clientes}</span>
                        </div>
                    </div>

                    {/* Services */}
                    <h3 className={styles.sectionTitle}>Servicios</h3>
                    <div className={styles.servicesList}>
                        {demo.services.map((s, i) => (
                            <div key={i} className={styles.serviceRow}>
                                <div>
                                    <span className={styles.serviceName}>{s.name}</span>
                                    <span className={styles.serviceDuration}>{s.duration} min</span>
                                </div>
                                <span className={styles.servicePrice}>${s.price.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    {/* Today's appointments */}
                    <h3 className={styles.sectionTitle}>Turnos de hoy</h3>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Hora</th>
                                    <th>Cliente</th>
                                    <th className="hide-mobile">Servicio</th>
                                    <th className="hide-mobile">Profesional</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {demo.appointments.map((apt, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{apt.time}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <div className="avatar avatar-sm">{apt.client[0]}</div>
                                                {apt.client}
                                            </div>
                                        </td>
                                        <td className="hide-mobile">{apt.service}</td>
                                        <td className="hide-mobile">{apt.professional}</td>
                                        <td>
                                            <span className={`badge ${apt.status === 'confirmed' ? 'badge-success' : 'badge-warning'}`}>
                                                {apt.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Team */}
                    <h3 className={styles.sectionTitle}>Equipo</h3>
                    <div className={styles.teamGrid}>
                        {demo.team.map((m, i) => (
                            <div key={i} className="card card-compact">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <div className="avatar">{m.name[0]}</div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{m.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
