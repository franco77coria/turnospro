'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import styles from './PhotoGallery.module.css'

/**
 * Galería de la ficha del negocio: mosaico + visor a pantalla completa.
 * Las imágenes se renderizan siempre en el HTML (aunque el visor esté
 * cerrado) para que el buscador las indexe.
 */
export default function PhotoGallery({ photos = [], businessName = '' }) {
    const [openIndex, setOpenIndex] = useState(null)
    const isOpen = openIndex !== null
    const total = photos.length
    const viewerRef = useRef(null)
    // Para devolver el foco a la miniatura desde la que se abrió el visor
    const openerRef = useRef(null)

    const close = useCallback(() => setOpenIndex(null), [])
    const prev = useCallback(() => setOpenIndex(i => (i - 1 + total) % total), [total])
    const next = useCallback(() => setOpenIndex(i => (i + 1) % total), [total])

    function openAt(index, event) {
        openerRef.current = event.currentTarget
        setOpenIndex(index)
    }

    useEffect(() => {
        if (!isOpen) return
        const viewer = viewerRef.current
        const focusables = () => Array.from(
            viewer?.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])') || []
        )

        function onKey(e) {
            if (e.key === 'Escape') { close(); return }
            if (e.key === 'ArrowLeft') { prev(); return }
            if (e.key === 'ArrowRight') { next(); return }
            // Trampa de foco: un diálogo modal no puede dejar tabular al fondo.
            if (e.key !== 'Tab') return
            const items = focusables()
            if (items.length === 0) return
            const first = items[0]
            const last = items[items.length - 1]
            const active = document.activeElement
            if (e.shiftKey && (active === first || !viewer.contains(active))) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && active === last) {
                e.preventDefault()
                first.focus()
            }
        }

        window.addEventListener('keydown', onKey)
        // Sin esto el fondo scrollea detrás del visor abierto.
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        // El foco entra al visor, no queda atrás en la miniatura.
        focusables()[0]?.focus()

        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
            openerRef.current?.focus?.()
        }
    }, [isOpen, close, prev, next])

    if (total === 0) return null

    // Con una sola foto el mosaico de dos columnas queda desbalanceado.
    const layout = total === 1 ? styles.single : total === 2 ? styles.double : styles.mosaic

    return (
        <>
            <div className={`${styles.grid} ${layout}`}>
                {photos.slice(0, 5).map((photo, i) => (
                    <button
                        key={photo.id || i}
                        className={styles.cell}
                        onClick={(e) => openAt(i, e)}
                        aria-label={`Ver foto ${i + 1} de ${total}`}
                    >
                        <Image
                            src={photo.url}
                            alt={photo.alt || `${businessName} — foto ${i + 1}`}
                            fill
                            sizes="(max-width: 720px) 50vw, 33vw"
                            style={{ objectFit: 'cover' }}
                            priority={i === 0}
                        />
                        {i === 4 && total > 5 && (
                            <span className={styles.more}>+{total - 5}</span>
                        )}
                    </button>
                ))}
            </div>

            {isOpen && (
                <div
                    className={styles.viewer}
                    onClick={close}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Fotos de ${businessName}`}
                    ref={viewerRef}
                >
                    <button className={styles.close} onClick={close} aria-label="Cerrar">
                        <X size={22} />
                    </button>

                    {total > 1 && (
                        <button
                            className={`${styles.nav} ${styles.navPrev}`}
                            onClick={e => { e.stopPropagation(); prev() }}
                            aria-label="Foto anterior"
                        >
                            <ChevronLeft size={26} />
                        </button>
                    )}

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        className={styles.viewerImg}
                        src={photos[openIndex].url}
                        alt={photos[openIndex].alt || `${businessName} — foto ${openIndex + 1}`}
                        onClick={e => e.stopPropagation()}
                    />

                    {total > 1 && (
                        <button
                            className={`${styles.nav} ${styles.navNext}`}
                            onClick={e => { e.stopPropagation(); next() }}
                            aria-label="Foto siguiente"
                        >
                            <ChevronRight size={26} />
                        </button>
                    )}

                    <span className={styles.counter}>{openIndex + 1} / {total}</span>
                </div>
            )}
        </>
    )
}
