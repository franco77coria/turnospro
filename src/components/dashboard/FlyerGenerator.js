'use client'

/**
 * Genera el flyer de turnos libres del día para publicar.
 *
 * WIP — primera versión. Lo que falta está anotado al final del archivo.
 *
 * Los horarios salen de generateAvailableSlots, el mismo generador de la
 * pantalla de reserva. Si el flyer tuviera su propia copia de la regla,
 * publicaría horarios que la app no ofrece.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Share2, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { FORMATOS, dibujarFlyer } from '@/lib/flyer'
import {
    generateAvailableSlots, formatDateEs, formatDateLocal,
    toOccupiedRanges, DEFAULT_DURATION,
} from '@/lib/scheduling'
import { resolverTema, derivarPaleta } from '@/lib/theme'
import { appUrl } from '@/lib/app-url'
import styles from './FlyerGenerator.module.css'

/** Familias reales de las fuentes del sistema de diseño, para el canvas. */
function leerFuentes() {
    if (typeof window === 'undefined') return { display: 'sans-serif', cuerpo: 'sans-serif' }
    const cs = getComputedStyle(document.documentElement)
    // next/font genera nombres ofuscados; las variables CSS los exponen.
    const display = cs.getPropertyValue('--font-bricolage').trim() || 'sans-serif'
    const cuerpo = cs.getPropertyValue('--font-jakarta').trim() || 'sans-serif'
    return { display: `${display}, sans-serif`, cuerpo: `${cuerpo}, sans-serif` }
}

export default function FlyerGenerator() {
    const { business } = useAuth()
    const canvasRef = useRef(null)
    const [fecha, setFecha] = useState(formatDateLocal(new Date()))
    const [formatoId, setFormatoId] = useState('feed')
    const [horarios, setHorarios] = useState([])
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState('')

    const formato = FORMATOS[formatoId]

    // ── Traer los turnos del día y derivar la grilla ──
    const cargar = useCallback(async () => {
        if (!supabase || !business?.id) return
        setCargando(true)
        setError('')
        try {
            const { data, error: err } = await supabase
                .from('appointments')
                .select('id, time, duration, team_member_id, status')
                .eq('business_id', business.id)
                .eq('date', fecha)
                .not('status', 'in', '("cancelled","no_show")')

            // Nunca derivar disponibilidad de un select que puede volver vacío
            // por permisos: sin esto, un error de RLS se publicaría como
            // "tengo todo el día libre".
            if (err) throw err

            const ocupados = toOccupiedRanges(data || [])
            const slots = generateAvailableSlots({
                settings: business.settings,
                duration: parseInt(business.settings?.slot_duration, 10) || DEFAULT_DURATION,
                occupied: ocupados,
                date: fecha,
                includeOccupied: true,
                // Para un día futuro no aplica la antelación mínima de hoy.
                enforceMinAdvance: fecha === formatDateLocal(new Date()),
            })
            setHorarios(slots)
        } catch (e) {
            console.error('Flyer: error al cargar turnos', e)
            setError('No se pudieron leer los turnos del día. Probá de nuevo.')
            setHorarios([])
        }
        setCargando(false)
    }, [business?.id, business?.settings, fecha])

    useEffect(() => { cargar() }, [cargar])

    // ── Dibujar ──
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || error) return

        const pintar = () => {
            canvas.width = formato.ancho
            canvas.height = formato.alto
            const ctx = canvas.getContext('2d')
            const tema = resolverTema(business?.settings?.theme)
            const { claro } = derivarPaleta(tema.primario, tema.secundario)

            const base = appUrl().replace(/^https?:\/\//, '')
            const ruta = business?.slug ? `/book/s/${business.slug}` : `/book/${business?.id || ''}`

            dibujarFlyer(ctx, {
                nombreNegocio: business?.name || 'Mi negocio',
                fechaTexto: formatDateEs(fecha, { weekday: 'long', day: 'numeric', month: 'long' }),
                horarios,
                enlace: `${base}${ruta}`,
                colorPrimario: claro['--pink'],
                colorSecundario: claro['--violet'],
            }, formato, leerFuentes())
        }

        // Sin esperar a las fuentes, el canvas dibuja con la de respaldo y el
        // flyer sale con otra tipografía que la app.
        if (document.fonts?.ready) document.fonts.ready.then(pintar)
        else pintar()
    }, [horarios, formato, business, fecha, error])

    const nombreArchivo = () =>
        `turnos-${(business?.slug || 'glowup')}-${fecha}-${formatoId}.png`

    const descargar = () => {
        canvasRef.current?.toBlob((blob) => {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = nombreArchivo()
            a.click()
            URL.revokeObjectURL(url)
        }, 'image/png')
    }

    /** En el celular, compartir directo evita el paso por la galería. */
    const compartir = () => {
        canvasRef.current?.toBlob(async (blob) => {
            if (!blob) return
            const file = new File([blob], nombreArchivo(), { type: 'image/png' })
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: 'Turnos libres' })
                } catch { /* el usuario canceló */ }
            } else {
                descargar()
            }
        }, 'image/png')
    }

    const libres = horarios.filter((h) => h.available).length

    return (
        <div className={styles.contenedor}>
            <div className={styles.controles}>
                <div className={styles.campo}>
                    <label className="label" htmlFor="flyer-fecha">Día</label>
                    <input
                        id="flyer-fecha"
                        type="date"
                        className="input"
                        value={fecha}
                        min={formatDateLocal(new Date())}
                        onChange={(e) => setFecha(e.target.value)}
                    />
                </div>

                <div className={styles.campo}>
                    <span className="label">Formato</span>
                    <div className={styles.formatos}>
                        {Object.values(FORMATOS).map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                className={`${styles.chipFormato} ${formatoId === f.id ? styles.chipFormatoActivo : ''}`}
                                onClick={() => setFormatoId(f.id)}
                                aria-pressed={formatoId === f.id}
                            >
                                {f.nombre}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error ? (
                <div className={styles.aviso}>
                    <p>{error}</p>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={cargar}>
                        <RefreshCw size={14} /> Reintentar
                    </button>
                </div>
            ) : (
                <>
                    <p className={styles.resumen}>
                        {cargando
                            ? 'Leyendo la agenda…'
                            : horarios.length === 0
                                ? 'Ese día el negocio no atiende.'
                                : <><strong>{libres}</strong> {libres === 1 ? 'turno libre' : 'turnos libres'} de {horarios.length}</>}
                    </p>

                    <div className={styles.vistaPrevia}>
                        <canvas ref={canvasRef} className={styles.canvas} aria-label="Vista previa del flyer" />
                    </div>

                    <div className={styles.acciones}>
                        <button type="button" className="btn btn-primary" onClick={descargar} disabled={cargando}>
                            <Download size={15} /> Descargar
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={compartir} disabled={cargando}>
                            <Share2 size={15} /> Compartir
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

/*
 * Pendiente (WIP):
 *  - QR al link de reserva, para la historia de Instagram donde no hay enlace
 *    clickeable salvo que tengas el sticker.
 *  - Logo del negocio arriba, cuando tenga uno cargado.
 *  - Filtrar por profesional: en un negocio con varios, "turnos libres" hoy
 *    mezcla la disponibilidad de todos.
 *  - Un par de variantes de diseño para que no publiquen siempre la misma
 *    imagen.
 */
