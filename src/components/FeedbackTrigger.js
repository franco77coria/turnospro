'use client'

/**
 * Punto de entrada al feedback. Encapsula el estado del diálogo para que cada
 * pantalla lo monte con una línea y no repita el useState.
 *
 * `variante` decide cómo se ve, no qué hace:
 *   - 'fila'  → item de menú, para la lista de ajustes del cliente
 *   - 'boton' → botón normal, para una tarjeta del panel
 */

import { useState } from 'react'
import { MessageSquareHeart, ChevronRight } from 'lucide-react'
import FeedbackDialog from './FeedbackDialog'

export default function FeedbackTrigger({ variante = 'boton', className = '', children }) {
    const [abierto, setAbierto] = useState(false)

    const etiqueta = children || 'Contanos qué te parece'

    return (
        <>
            {variante === 'fila' ? (
                <button
                    type="button"
                    className={className}
                    onClick={() => setAbierto(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        width: '100%', background: 'none', border: 'none',
                        font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left',
                    }}
                >
                    <MessageSquareHeart size={20} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{etiqueta}</span>
                    <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
                </button>
            ) : (
                <button
                    type="button"
                    className={className || 'btn btn-secondary'}
                    onClick={() => setAbierto(true)}
                >
                    <MessageSquareHeart size={15} aria-hidden="true" />
                    {etiqueta}
                </button>
            )}

            <FeedbackDialog abierto={abierto} onCerrar={() => setAbierto(false)} />
        </>
    )
}
