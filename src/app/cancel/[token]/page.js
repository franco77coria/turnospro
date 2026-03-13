'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Check, X, AlertTriangle, CalendarX } from 'lucide-react'
import Link from 'next/link'

export default function CancelPage() {
    const { token } = useParams()
    const [status, setStatus] = useState('confirm') // confirm | loading | success | error
    const [result, setResult] = useState(null)
    const [errorMsg, setErrorMsg] = useState('')

    async function handleCancel() {
        setStatus('loading')
        try {
            const res = await fetch('/api/appointments/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErrorMsg(data.error || 'Error al cancelar')
                setStatus('error')
                return
            }
            setResult(data.appointment)
            setStatus('success')
        } catch (err) {
            setErrorMsg('Error de conexión. Intentá de nuevo.')
            setStatus('error')
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: 'var(--space-4)',
        }}>
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border)',
                padding: 'var(--space-8)',
                maxWidth: 440,
                width: '100%',
                textAlign: 'center',
            }}>
                {status === 'confirm' && (
                    <>
                        <CalendarX size={40} style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)' }} />
                        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-2)' }}>
                            Cancelar turno
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                            ¿Estás seguro de que querés cancelar tu turno? Esta acción no se puede deshacer.
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                            <Link href="/" className="btn btn-secondary">
                                Volver
                            </Link>
                            <button className="btn btn-primary" onClick={handleCancel}
                                style={{ background: 'var(--danger)' }}>
                                Sí, cancelar turno
                            </button>
                        </div>
                    </>
                )}

                {status === 'loading' && (
                    <>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-4)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Cancelando turno...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%',
                            background: 'var(--success-light)', color: 'var(--success)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto var(--space-4)',
                        }}>
                            <Check size={28} />
                        </div>
                        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-2)' }}>
                            Turno cancelado
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                            Tu turno fue cancelado exitosamente.
                        </p>
                        {result && (
                            <div style={{
                                background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
                                fontSize: 'var(--font-size-sm)', textAlign: 'left',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Servicio</span>
                                    <span>{result.service_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Fecha</span>
                                    <span>{new Date(result.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Hora</span>
                                    <span>{result.time}</span>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertTriangle size={40} style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)' }} />
                        <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-2)' }}>
                            No se pudo cancelar
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                            {errorMsg}
                        </p>
                        <button className="btn btn-primary" onClick={() => setStatus('confirm')}>
                            Intentar de nuevo
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
