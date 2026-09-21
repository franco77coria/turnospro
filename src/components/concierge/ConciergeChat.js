'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, MapPin, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import styles from './ConciergeChat.module.css'

const categories = [
    ['barberia', 'Barbería'], ['peluqueria', 'Peluquería'], ['unas', 'Uñas'],
    ['lash', 'Lash y cejas'], ['spa', 'Spa y estética'], ['consultorio', 'Consultorio'],
    ['veterinaria', 'Veterinaria'], ['custom', 'Otro rubro'],
]
const times = [['today', 'Hoy, lo antes posible'], ['afternoon', 'Hoy por la tarde'], ['tomorrow', 'Mañana']]

export default function ConciergeChat() {
    const [open, setOpen] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [step, setStep] = useState(0)
    const [category, setCategory] = useState('')
    const [services, setServices] = useState([])
    const [service, setService] = useState('')
    const [when, setWhen] = useState('today')
    const [zone, setZone] = useState('')
    const [matches, setMatches] = useState([])
    const [zoneHasMatches, setZoneHasMatches] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const panel = useRef(null)
    const trigger = useRef(null)
    const request = useRef(0)

    useEffect(() => {
        if (!open) return
        panel.current?.querySelector('button')?.focus()
        const onKey = event => {
            if (event.key === 'Escape') {
                setOpen(false)
                trigger.current?.focus()
            }
            if (event.key === 'Tab' && expanded) {
                const focusables = [...panel.current.querySelectorAll('button:not(:disabled), input, a[href]')]
                if (!focusables.length) return
                if (event.shiftKey && document.activeElement === focusables[0]) {
                    event.preventDefault(); focusables.at(-1).focus()
                } else if (!event.shiftKey && document.activeElement === focusables.at(-1)) {
                    event.preventDefault(); focusables[0].focus()
                }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, expanded])

    function close() {
        setOpen(false)
        setExpanded(false)
        trigger.current?.focus()
    }

    function reset() {
        request.current++
        setStep(0); setCategory(''); setService(''); setServices([])
        setZone(''); setMatches([]); setError(''); setLoading(false)
    }

    async function chooseCategory(value) {
        setCategory(value); setStep(1); setLoading(true); setError('')
        const version = ++request.current
        try {
            const res = await fetch(`/api/concierge/match?category=${value}`)
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            if (version === request.current) setServices(json.services || [])
        } catch (err) {
            if (version === request.current) setError(err.message || 'No pudimos cargar los servicios.')
        } finally { if (version === request.current) setLoading(false) }
    }

    async function search(location = {}) {
        setStep(4); setLoading(true); setError(''); setMatches([])
        const version = ++request.current
        try {
            const res = await fetch('/api/concierge/match', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, service: service || undefined, when, zone: zone.trim() || undefined, ...location }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            if (version === request.current) {
                setMatches(json.matches || [])
                setZoneHasMatches(json.zoneHasMatches !== false)
            }
        } catch (err) {
            if (version === request.current) setError(err.message || 'No pudimos verificar los horarios.')
        } finally { if (version === request.current) setLoading(false) }
    }

    function useLocation() {
        if (!navigator.geolocation) { setError('Tu dispositivo no ofrece ubicación. Escribí un barrio o buscá en todas las zonas.'); return }
        setLoading(true); setError('')
        navigator.geolocation.getCurrentPosition(
            position => search({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => { setLoading(false); setError('No pudimos usar tu ubicación. Podés escribir un barrio o buscar en todas las zonas.') },
            { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false },
        )
    }

    return <>
        {!open && <button ref={trigger} className={styles.trigger} type="button" onClick={() => setOpen(true)} aria-label="Buscar un turno con la guía de GLOWUP">
            <span className={styles.badge}>¿Buscás turno hoy?</span>
            <Image src="/logo.png" alt="" width={42} height={42} />
        </button>}
        {open && <div className={expanded ? styles.overlay : styles.shell}>
            <section ref={panel} role="dialog" aria-modal={expanded ? 'true' : 'false'} aria-label="Buscar un turno" className={`${styles.panel} ${expanded ? styles.expanded : ''}`}>
                <header className={styles.header}>
                    <div className={styles.brand}><Image src="/logo.png" alt="" width={38} height={38} /><div><strong>Encontrá tu turno</strong><span>Guía rápida · sin IA</span></div></div>
                    <div className={styles.tools}>
                        <button type="button" onClick={reset} aria-label="Reiniciar búsqueda" title="Reiniciar"><RotateCcw size={18}/></button>
                        <button type="button" onClick={() => setExpanded(v => !v)} aria-label={expanded ? 'Reducir ventana' : 'Pantalla completa'} title={expanded ? 'Reducir' : 'Expandir'}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button>
                        <button type="button" onClick={close} aria-label="Cerrar búsqueda"><X size={20}/></button>
                    </div>
                </header>
                <div className={styles.body} aria-live="polite">
                    <div className={styles.progress}>PASO {Math.min(step + 1, 5)} DE 5 <span>{['Rubro', 'Servicio', 'Cuándo', 'Dónde', 'Opciones'][step]}</span></div>
                    {step > 0 && step < 4 && <button className={styles.back} onClick={() => { request.current++; setLoading(false); setError(''); setStep(step - 1) }}><ArrowLeft size={15}/> Atrás</button>}
                    {step === 0 && <><h2>¿Qué necesitás reservar?</h2><p>Elegí un rubro para ver servicios y horarios reales.</p><div className={styles.grid}>{categories.map(([key, label]) => <button type="button" key={key} onClick={() => chooseCategory(key)}>{label}<ArrowRight size={16}/></button>)}</div></>}
                    {step === 1 && <><h2>¿Qué servicio buscás?</h2><p>La duración cambia los horarios que podemos ofrecerte.</p>{loading ? <p>Buscando servicios…</p> : <div className={styles.choices}><button onClick={() => { setService(''); setStep(2) }}>Cualquiera de este rubro <ArrowRight size={16}/></button>{services.map(name => <button key={name} onClick={() => { setService(name); setStep(2) }}>{name}<ArrowRight size={16}/></button>)}</div>}</>}
                    {step === 2 && <><h2>¿Para cuándo?</h2><p>Si hoy no queda lugar, también te mostramos el primer turno de mañana.</p><div className={styles.choices}>{times.map(([key, label]) => <button key={key} onClick={() => { setWhen(key); setStep(3) }}>{label}<ArrowRight size={16}/></button>)}</div></>}
                    {step === 3 && <><h2>¿Dónde te queda cómodo?</h2><p>La ubicación es opcional. Solo mostramos distancia cuando el negocio tiene coordenadas cargadas.</p><div className={styles.location}>
                        <button type="button" onClick={useLocation} disabled={loading}><MapPin size={18}/> Usar mi ubicación</button>
                        <form onSubmit={e => { e.preventDefault(); search() }}><label htmlFor="concierge-zone">O escribí tu barrio o zona</label><div><input id="concierge-zone" value={zone} maxLength={80} onChange={e => setZone(e.target.value)} placeholder="Ej. Palermo"/><button type="submit" disabled={loading}>Buscar</button></div></form>
                        <button type="button" className={styles.anywhere} onClick={() => { setZone(''); search({ zone: '' }) }} disabled={loading}>Ver todas las zonas</button>
                    </div></>}
                    {step === 4 && <><h2>Turnos para vos</h2><p>Elegí un resultado y confirmá el horario en la agenda del negocio.</p>{loading ? <p className={styles.loading}>Verificando agendas…</p> : <>
                        {!zoneHasMatches && <p className={styles.notice}>No encontramos una dirección que coincida con esa zona. Te mostramos otras opciones.</p>}
                        {matches.length ? <div className={styles.results}>{matches.map(m => <article key={m.businessId} className={styles.result}>
                            <div className={styles.resultTop}>{m.cover
                                ? <Image className={styles.cover} src={m.cover} alt="" width={48} height={48} unoptimized />
                                : <span className={styles.monogram}>{m.name?.charAt(0)}</span>}
                                <div><strong>{m.name}</strong><small>{m.address || 'Dirección en la ficha'}{m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}</small></div></div>
                            <p><b>{m.dayOffset ? 'Mañana' : 'Hoy'} {m.time.slice(0, 5)}</b> · {m.service}</p>
                            <Link href={m.href} onClick={close}>Elegir horario <ArrowRight size={16}/></Link>
                        </article>)}</div> : <div className={styles.empty}>Todavía no hay horarios disponibles para esta búsqueda. Probá otro rubro o momento.</div>}
                        <button className={styles.again} onClick={reset}>Empezar otra búsqueda</button>
                    </>}</>}
                    {error && <div role="alert" className={styles.error}>{error}{step === 4 && <button type="button" onClick={() => search()}>Reintentar</button>}{step === 1 && <button type="button" onClick={() => chooseCategory(category)}>Reintentar</button>}</div>}
                </div>
            </section>
        </div>}
    </>
}
