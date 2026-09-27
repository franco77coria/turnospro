'use client'

/**
 * Genera el flyer de turnos libres del día para publicar.
 *
 * Los horarios salen de generateAvailableSlots, el mismo generador de la
 * pantalla de reserva. Si el flyer tuviera su propia copia de la regla,
 * publicaría horarios que la app no ofrece.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Share2, RefreshCw } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { FORMATOS, dibujarFlyer } from '@/lib/flyer'
import {
    generateAvailableSlots, formatDateEs, formatDateLocal,
    toOccupiedRanges, isWorkDay,
} from '@/lib/scheduling'
import { loadBusinessServices } from '@/lib/services'
import { nowInTimezone } from '@/lib/timezone'
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

function cargarPortada(url) {
    if (!url) return Promise.resolve(null)
    return new Promise(resolve => {
        const image = new window.Image()
        const timeout = window.setTimeout(() => resolve(null), 7000)
        image.crossOrigin = 'anonymous'
        image.onload = () => {
            window.clearTimeout(timeout)
            resolve(image)
        }
        image.onerror = () => {
            window.clearTimeout(timeout)
            resolve(null)
        }
        image.src = url
    })
}

export default function FlyerGenerator() {
    const { business } = useAuth()
    const canvasRef = useRef(null)
    const qrRef = useRef(null)
    const dateInitialized = useRef(null)
    const [fecha, setFecha] = useState(formatDateLocal(new Date()))
    const [formatoId, setFormatoId] = useState('feed')
    const [horarios, setHorarios] = useState([])
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState('')
    const [services, setServices] = useState([])
    const [members, setMembers] = useState([])
    const [updatedAt, setUpdatedAt] = useState('')
    const [catalogReloadKey, setCatalogReloadKey] = useState(0)
    const [previewReady, setPreviewReady] = useState(false)

    const formato = FORMATOS[formatoId]
    const bookingUrl = `${appUrl()}${business?.slug ? `/book/s/${business.slug}` : `/book/${business?.id || ''}`}`

    useEffect(() => {
        if (!business?.id || dateInitialized.current === business.id) return
        dateInitialized.current = business.id
        setFecha(formatDateLocal(nowInTimezone(business.timezone || undefined)))
    }, [business?.id, business?.timezone])

    useEffect(() => {
        if (!business?.id || !supabase) return
        let active = true
        setError('')
        Promise.all([
            loadBusinessServices(supabase, business.id, { activeOnly: true }),
            supabase.from('team_members').select('id, name').eq('business_id', business.id).eq('active', true),
        ]).then(([catalog, team]) => {
            if (!active) return
            setServices(catalog)
            if (team.error) throw team.error
            setMembers(team.data || [])
        }).catch(() => { if (active) setError('No pudimos cargar el catálogo o el equipo.') })
        return () => { active = false }
    }, [business?.id, catalogReloadKey])

    // ── Traer los turnos del día y derivar la grilla ──
    const cargar = useCallback(async () => {
        if (!supabase || !business?.id || !services.length) return
        setCargando(true)
        setError('')
        try {
            const [bookings, closures, absences] = await Promise.all([
                supabase
                .from('appointments')
                .select('id, time, duration, team_member_id, status')
                .eq('business_id', business.id)
                .eq('date', fecha)
                .not('status', 'in', '("cancelled","no_show")'),
                supabase.from('business_closures').select('date').eq('business_id', business.id).eq('date', fecha),
                supabase.from('team_absences').select('team_member_id, start_date, end_date')
                    .eq('business_id', business.id).lte('start_date', fecha).gte('end_date', fecha),
            ])

            // Nunca derivar disponibilidad de un select que puede volver vacío
            // por permisos: sin esto, un error de RLS se publicaría como
            // "tengo todo el día libre".
            if (bookings.error || closures.error || absences.error) throw bookings.error || closures.error || absences.error

            const closed = !isWorkDay(business.settings, fecha) || closures.data?.length ||
                business.settings?.closed_dates?.some(c => c.date === fecha)
            const absentIds = new Set((absences.data || []).map(a => a.team_member_id))
            const availableTeam = members.filter(m => !absentIds.has(m.id))
            const noCapacity = members.length > 0 && availableTeam.length === 0
            // El horario del local se calcula con el servicio más corto que
            // efectivamente puede reservarse. La elección final la hace el
            // cliente y la API vuelve a validar duración y ocupación.
            const shortestDuration = Math.min(...services.map(s => s.duration))
            const now = nowInTimezone(business.timezone || undefined)

            const ocupados = toOccupiedRanges(bookings.data || [])
            const slots = closed || noCapacity ? [] : generateAvailableSlots({
                settings: business.settings,
                duration: shortestDuration,
                occupied: ocupados,
                capacity: Math.max(1, availableTeam.length),
                date: fecha,
                includeOccupied: false,
                now,
                enforceMinAdvance: true,
            })
            setHorarios(slots.slice(0, 12).map(time => ({ time, available: true })))
            setUpdatedAt(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
        } catch (e) {
            console.error('Flyer: error al cargar turnos', e)
            setError('No se pudieron leer los turnos del día. Probá de nuevo.')
            setHorarios([])
        }
        setCargando(false)
    }, [business?.id, business?.settings, business?.timezone, fecha, services, members])

    useEffect(() => { cargar() }, [cargar])

    // ── Dibujar ──
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || error) return
        let active = true
        setPreviewReady(false)

        const pintar = (coverImage) => {
            if (!active) return
            canvas.width = formato.ancho
            canvas.height = formato.alto
            const ctx = canvas.getContext('2d')
            // Si la barbería no eligió una marca propia, el flyer arranca
            // con una paleta enérgica; las demás categorías y los temas
            // elegidos por el dueño conservan sus colores.
            const tema = business?.business_type === 'barberia' && !business?.settings?.theme
                ? { primario: '#FA4B20', secundario: '#3122A5' }
                : resolverTema(business?.settings?.theme)
            const { claro } = derivarPaleta(tema.primario, tema.secundario)

            dibujarFlyer(ctx, {
                nombreNegocio: business?.name || 'Mi negocio',
                fechaTexto: formatDateEs(fecha, { weekday: 'long', day: 'numeric', month: 'long' }),
                horarios,
                enlace: bookingUrl,
                esHoy: fecha === formatDateLocal(nowInTimezone(business?.timezone || undefined)),
                actualizado: updatedAt,
                qrCanvas: qrRef.current,
                colorPrimario: claro['--pink'],
                colorSecundario: claro['--violet'],
                coverImage,
            }, formato, leerFuentes())
            setPreviewReady(true)
        }

        // Esperar la tipografía y la foto evita exportar una versión distinta
        // de la vista previa. Si la imagen no admite CORS, queda el celular ilustrado.
        Promise.all([document.fonts?.ready || Promise.resolve(), cargarPortada(business?.cover_image_url)])
            .then(([, coverImage]) => pintar(coverImage))
        return () => { active = false }
    }, [horarios, formato, business, fecha, error, bookingUrl, updatedAt])

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
                        min={formatDateLocal(nowInTimezone(business?.timezone || undefined))}
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
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => services.length ? cargar() : setCatalogReloadKey(key => key + 1)}>
                        <RefreshCw size={14} /> Reintentar
                    </button>
                </div>
            ) : (
                <>
                    <p className={styles.resumen}>
                        {cargando
                            ? 'Leyendo la agenda…'
                            : horarios.length === 0
                                ? services.length ? 'No quedan horarios libres para este día.' : 'Cargá al menos un servicio activo para generar el flyer.'
                                : <><strong>{libres}</strong> {libres === 1 ? 'horario libre' : 'horarios libres'} para mostrar</>}
                    </p>

                    <div className={styles.vistaPrevia}>
                        <canvas ref={canvasRef} className={styles.canvas} aria-label="Vista previa del flyer" />
                    </div>
                    <p className={styles.resumen}>Horarios del local para el servicio activo más corto. La disponibilidad se verificó a las {updatedAt || '—'}; actualizá antes de compartir. En historias, agregá el sticker de enlace para que se pueda reservar tocándolo.</p>
                    <div className={styles.acciones}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={cargar} disabled={cargando}><RefreshCw size={15} /> Actualizar horarios</button>
                    </div>

                    <div className={styles.acciones}>
                        <button type="button" className="btn btn-primary" onClick={descargar} disabled={cargando || !libres || !previewReady}>
                            <Download size={15} /> Descargar
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={compartir} disabled={cargando || !libres || !previewReady}>
                            <Share2 size={15} /> Compartir
                        </button>
                    </div>
                </>
            )}
            <div className={styles.qrHidden} aria-hidden="true"><QRCodeCanvas value={bookingUrl} size={180} ref={qrRef} /></div>
        </div>
    )
}
