'use client'

/**
 * Barra deslizable de "muy malo" a "muy bueno".
 *
 * Por debajo es un <input type="range"> nativo: se arrastra con el dedo, se
 * mueve con las flechas del teclado y los lectores de pantalla lo anuncian
 * solo. Todo lo visible está dibujado encima; el input queda transparente.
 *
 * La cara es un SVG cuya boca se dibuja con el valor, no cinco imágenes
 * distintas: la curva interpola, así que el gesto acompaña al arrastre en
 * vez de saltar entre estados.
 */

import { useId, useState } from 'react'
import styles from './RatingSlider.module.css'

const ETIQUETAS = ['Muy malo', 'Malo', 'Normal', 'Bueno', 'Muy bueno']

/**
 * Boca del SVG. `t` va de 0 (peor) a 1 (mejor).
 * En el medio la curva se aplana sola y queda una línea recta.
 */
function pathBoca(t) {
    const curva = (t - 0.5) * 2      // -1 boca triste, +1 boca sonriente
    const y = 40 - curva * 3          // la boca sube un poco al sonreír
    const control = y + curva * 15
    return `M 20 ${y} Q 32 ${control} 44 ${y}`
}

/** Los ojos bajan apenas cuando la cara está contenta. */
function alturaOjos(t) {
    return 25 + (1 - t) * 1.5
}

export default function RatingSlider({ valor, onChange }) {
    const id = useId()
    // Sin tocar todavía: el pulgar arranca al medio pero apagado, para que no
    // parezca que ya se votó "normal".
    const [tocado, setTocado] = useState(valor != null)
    const actual = valor ?? 3
    const t = (actual - 1) / 4

    const cambiar = (n) => {
        setTocado(true)
        onChange(n)
    }

    return (
        <div className={styles.contenedor}>
            <div className={styles.cabecera}>
                <svg
                    className={`${styles.cara} ${tocado ? styles.caraActiva : ''}`}
                    viewBox="0 0 64 64"
                    aria-hidden="true"
                >
                    <circle cx="32" cy="32" r="30" className={styles.caraFondo} />
                    <circle cx="23" cy={alturaOjos(t)} r="3.2" className={styles.caraRasgo} />
                    <circle cx="41" cy={alturaOjos(t)} r="3.2" className={styles.caraRasgo} />
                    <path
                        d={pathBoca(t)}
                        className={styles.caraBoca}
                        fill="none"
                        strokeWidth="3.4"
                        strokeLinecap="round"
                    />
                </svg>

                <span className={`${styles.etiqueta} ${tocado ? styles.etiquetaActiva : ''}`}>
                    {tocado ? ETIQUETAS[actual - 1] : 'Arrastrá para puntuar'}
                </span>
            </div>

            <div className={styles.pista}>
                {/* El relleno se pinta hasta donde llegó el pulgar. */}
                <div
                    className={`${styles.relleno} ${tocado ? styles.rellenoActivo : ''}`}
                    style={{ width: `${t * 100}%` }}
                />
                <div className={styles.marcas} aria-hidden="true">
                    {ETIQUETAS.map((_, i) => (
                        <span
                            key={i}
                            className={`${styles.marca} ${tocado && i <= actual - 1 ? styles.marcaActiva : ''}`}
                        />
                    ))}
                </div>
                <input
                    id={id}
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={actual}
                    onChange={(e) => cambiar(Number(e.target.value))}
                    className={styles.input}
                    aria-label="Puntuación"
                    aria-valuetext={tocado ? ETIQUETAS[actual - 1] : 'Sin puntuar'}
                />
                <span
                    className={`${styles.pulgar} ${tocado ? styles.pulgarActivo : ''}`}
                    style={{ left: `${t * 100}%` }}
                    aria-hidden="true"
                />
            </div>

            <div className={styles.extremos} aria-hidden="true">
                <span>Muy malo</span>
                <span>Muy bueno</span>
            </div>
        </div>
    )
}
