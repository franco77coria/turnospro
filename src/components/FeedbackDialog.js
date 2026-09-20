'use client'

/**
 * Diálogo para contar qué te parece la app.
 *
 * Dos preguntas y listo. Cada campo extra baja la cantidad de respuestas, así
 * que la nota es opcional y lo único obligatorio es el texto: alguien que se
 * tomó el trabajo de escribir es justamente el que no hay que frenar.
 */

import { useState, useEffect, useRef } from 'react'
import { X, Send, MessageSquareHeart, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import RatingSlider from './RatingSlider'
import styles from './FeedbackDialog.module.css'

const TIPOS = [
    { id: 'cambiaria', etiqueta: 'Cambiaría algo' },
    { id: 'falla', etiqueta: 'Encontré una falla' },
    { id: 'idea', etiqueta: 'Se me ocurrió algo' },
    { id: 'gusta', etiqueta: 'Me gusta' },
]

export default function FeedbackDialog({ abierto, onCerrar }) {
    const { user, profile, business } = useAuth()
    const [puntaje, setPuntaje] = useState(null)
    const [tipo, setTipo] = useState('cambiaria')
    const [mensaje, setMensaje] = useState('')
    const [contactable, setContactable] = useState(true)
    const [enviando, setEnviando] = useState(false)
    const [enviado, setEnviado] = useState(false)
    const [error, setError] = useState('')
    const textareaRef = useRef(null)

    const esNegocio = Boolean(business?.id) || profile?.account_type === 'business'

    useEffect(() => {
        if (!abierto) return
        setEnviado(false)
        setError('')
        const alEscapar = (e) => { if (e.key === 'Escape') onCerrar() }
        document.addEventListener('keydown', alEscapar)
        // El foco va al textarea: es lo único que hay que completar sí o sí.
        const t = setTimeout(() => textareaRef.current?.focus(), 80)
        return () => {
            document.removeEventListener('keydown', alEscapar)
            clearTimeout(t)
        }
    }, [abierto, onCerrar])

    if (!abierto) return null

    const enviar = async (e) => {
        e.preventDefault()
        if (mensaje.trim().length < 3) {
            setError('Contanos un poco más, aunque sea en una línea.')
            return
        }
        setEnviando(true)
        setError('')
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    puntaje,
                    tipo,
                    mensaje: mensaje.trim(),
                    rol: esNegocio ? 'negocio' : 'cliente',
                    ruta: typeof window !== 'undefined' ? window.location.pathname : null,
                    business_id: business?.id || null,
                    contactable: contactable && Boolean(user),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                // Los errores de validación (400) y el de exceso de envíos (429)
                // explican algo accionable y se muestran tal cual. Cualquier
                // otro se reemplaza: el texto del servidor puede venir en
                // inglés o filtrar detalles de implementación.
                const esAccionable = res.status === 400 || res.status === 429
                throw new Error(
                    esAccionable && data.error
                        ? data.error
                        : 'No se pudo enviar. Probá de nuevo en un momento.'
                )
            }

            setEnviado(true)
            setMensaje('')
            setPuntaje(null)
            // Se cierra solo, pero con tiempo de leer el agradecimiento.
            setTimeout(() => onCerrar(), 2200)
        } catch (err) {
            setError(err.message || 'No se pudo enviar. Probá de nuevo.')
        }
        setEnviando(false)
    }

    return (
        <div
            className="modal-overlay"
            onClick={(e) => e.target === e.currentTarget && onCerrar()}
            role="dialog"
            aria-modal="true"
            aria-label="Contanos qué te parece"
        >
            <div className={`modal ${styles.modal}`}>
                <div className="modal-header">
                    <h3 className={styles.titulo}>
                        <MessageSquareHeart size={17} aria-hidden="true" />
                        {enviado ? '¡Gracias!' : 'Contanos qué te parece'}
                    </h3>
                    <button className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                {enviado ? (
                    <div className={styles.exito}>
                        <div className={styles.exitoIcono}><Check size={26} strokeWidth={3} /></div>
                        <p className={styles.exitoTexto}>
                            Lo leemos todo. Gracias por tomarte el momento.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={enviar} className="modal-body">
                        <div className={styles.grupo}>
                            <span className={styles.etiqueta}>
                                ¿Cómo la venís pasando con la app?
                                <span className={styles.opcional}>opcional</span>
                            </span>
                            <RatingSlider valor={puntaje} onChange={setPuntaje} />
                        </div>

                        <div className={styles.grupo}>
                            <span className={styles.etiqueta}>¿De qué se trata?</span>
                            <div className={styles.tipos}>
                                {TIPOS.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        className={`${styles.chip} ${tipo === t.id ? styles.chipActivo : ''}`}
                                        onClick={() => setTipo(t.id)}
                                        aria-pressed={tipo === t.id}
                                    >
                                        {t.etiqueta}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.grupo}>
                            <label className={styles.etiqueta} htmlFor="feedback-mensaje">
                                {tipo === 'gusta'
                                    ? '¿Qué es lo que más te sirve?'
                                    : tipo === 'falla'
                                        ? '¿Qué pasó? Contanos qué estabas haciendo'
                                        : '¿Qué cambiarías?'}
                            </label>
                            <textarea
                                id="feedback-mensaje"
                                ref={textareaRef}
                                className={`input ${styles.textarea}`}
                                rows={4}
                                maxLength={2000}
                                value={mensaje}
                                onChange={(e) => setMensaje(e.target.value)}
                                placeholder="Escribí con tus palabras, no hace falta que sea prolijo."
                            />
                            <span className={styles.contador}>{mensaje.length}/2000</span>
                        </div>

                        {user && (
                            <label className={styles.checkbox}>
                                <input
                                    type="checkbox"
                                    checked={contactable}
                                    onChange={(e) => setContactable(e.target.checked)}
                                />
                                <span>Pueden escribirme si necesitan que les explique mejor</span>
                            </label>
                        )}

                        {error && <p className={styles.error}>{error}</p>}

                        <div className={styles.acciones}>
                            <button type="button" className="btn btn-ghost" onClick={onCerrar}>
                                Ahora no
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={enviando}>
                                {enviando
                                    ? <div className="loading-spinner" />
                                    : <><Send size={15} aria-hidden="true" /> Enviar</>}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
