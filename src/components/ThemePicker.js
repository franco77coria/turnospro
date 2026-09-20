'use client'

/**
 * Selector del color de marca.
 *
 * Presets curados en vez de una rueda de color libre: cada par está elegido
 * para que el degradado de los botones cierre, y el derivado legible se
 * calcula solo. Igual se admite un color propio, porque un negocio con
 * identidad definida lo va a pedir — pero ese también pasa por la corrección
 * de contraste, así que no puede quedar texto ilegible.
 */

import { useState, useEffect, useRef } from 'react'
import { Check, Palette } from 'lucide-react'
import { TEMAS, resolverTema, derivarPaleta, aplicarTema, hexARgb, contraste } from '@/lib/theme'
import styles from './ThemePicker.module.css'

const PAPEL_CLARO = '#FFFFFF'

export default function ThemePicker({ valor, onChange, descripcion }) {
    const actual = resolverTema(valor)
    const [hexPropio, setHexPropio] = useState(
        actual.id === 'custom' ? actual.primario : ''
    )

    // Vista previa en vivo: al pasar por encima se aplica el tema al documento
    // y se revierte al salir. Ver el color en la app entera dice mucho más que
    // un cuadradito.
    const previsualizar = (tema) => aplicarTema(tema)
    const restaurar = () => aplicarTema(valor)

    // Cada vez que cambia el valor confirmado, se aplica. Eso hace de
    // "restaurar" cuando el puntero sale de una muestra, y deja la app entera
    // con el color recién elegido.
    useEffect(() => { aplicarTema(valor) }, [valor])

    // Al desmontar hay que volver al último valor confirmado, no al que
    // estuviera previsualizándose. El ref evita el problema que tenía la
    // versión anterior: con [valor] en las dependencias, la función de
    // limpieza se ejecutaba en CADA cambio y con el valor VIEJO capturado,
    // así que al elegir un color se re-aplicaba el anterior y el nuevo no
    // llegaba a verse.
    const ultimoValor = useRef(valor)
    useEffect(() => { ultimoValor.current = valor }, [valor])
    useEffect(() => () => { aplicarTema(ultimoValor.current) }, [])

    const elegirPreset = (tema) => {
        setHexPropio('')
        onChange({ id: tema.id, primario: tema.primario, secundario: tema.secundario })
    }

    const aplicarPropio = (hex) => {
        setHexPropio(hex)
        if (hexARgb(hex)) onChange({ id: 'custom', primario: hex.toUpperCase() })
    }

    return (
        <div className={styles.contenedor}>
            <div className={styles.encabezado}>
                <Palette size={15} aria-hidden="true" />
                <div>
                    <h4 className={styles.titulo}>Color principal</h4>
                    {descripcion && <p className={styles.descripcion}>{descripcion}</p>}
                </div>
            </div>

            <div className={styles.grilla} role="radiogroup" aria-label="Color principal">
                {TEMAS.map((tema) => {
                    const activo = actual.id === tema.id
                    return (
                        <button
                            key={tema.id}
                            type="button"
                            role="radio"
                            aria-checked={activo}
                            className={`${styles.opcion} ${activo ? styles.opcionActiva : ''}`}
                            onClick={() => elegirPreset(tema)}
                            onMouseEnter={() => previsualizar(tema)}
                            onMouseLeave={restaurar}
                            onFocus={() => previsualizar(tema)}
                            onBlur={restaurar}
                            title={tema.nombre}
                        >
                            <span
                                className={styles.muestra}
                                style={{ background: `linear-gradient(135deg, ${tema.primario}, ${tema.secundario})` }}
                            >
                                {activo && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                            </span>
                            <span className={styles.nombre}>{tema.nombre}</span>
                        </button>
                    )
                })}
            </div>

            <div className={styles.propio}>
                <label className={styles.etiquetaPropio} htmlFor="color-propio">
                    ¿Tenés un color de marca?
                </label>
                <div className={styles.filaPropio}>
                    <input
                        id="color-propio"
                        type="color"
                        className={styles.inputColor}
                        value={hexARgb(hexPropio) ? hexPropio : actual.primario}
                        onChange={(e) => aplicarPropio(e.target.value)}
                    />
                    <input
                        type="text"
                        className={`input ${styles.inputHex}`}
                        placeholder="#FF2E8E"
                        value={hexPropio}
                        maxLength={7}
                        onChange={(e) => aplicarPropio(e.target.value)}
                        aria-label="Código hexadecimal del color"
                    />
                    {hexPropio && !hexARgb(hexPropio) && (
                        <span className={styles.aviso}>Código inválido</span>
                    )}
                </div>
                {hexARgb(hexPropio) && <AvisoContraste hex={hexPropio} />}
            </div>
        </div>
    )
}

/**
 * Cuando el color elegido no alcanza para texto, la app usa una versión
 * corregida en vez de mostrarlo ilegible. Conviene decirlo: si no, parece
 * que el color "no se aplicó bien" en algunos lugares.
 */
function AvisoContraste({ hex }) {
    if (contraste(hex, PAPEL_CLARO) >= 4.5) return null
    const { claro } = derivarPaleta(hex, hex)
    return (
        <p className={styles.notaContraste}>
            <span className={styles.puntoContraste} style={{ background: claro['--pink-ink'] }} />
            Para textos chicos se usa un tono más oscuro de tu color, así se lee bien
            sobre fondo claro.
        </p>
    )
}
