'use client'
import { useCallback, useEffect, useState } from 'react'
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

    const close = useCallback(() => setOpenIndex(null), [])
    const prev = useCallback(() => setOpenIndex(i => (i - 1 + total) % total), [total])
    const next = useCallback(() => setOpenIndex(i => (i + 1) % total), [total])

    useEffect(() => {
        if (!isOpen) return
        function onKey(e) {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowLeft') prev()
            if (e.key === 'ArrowRight') next()
        }
        window.addEventListener('keydown', onKey)
        // Sin esto el fondo scrollea detrás del visor abierto.
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = previous
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
                        onClick={() => setOpenIndex(i)}
                        aria-label={`Ver foto ${i + 1} de ${total}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={photo.url}
                            alt={photo.alt || `${businessName} — foto ${i + 1}`}
                            loading={i === 0 ? 'eager' : 'lazy'}
                        />
                        {i === 4 && total > 5 && (
                            <span className={styles.more}>+{total - 5}</span>
                        )}
                    </button>
                ))}
            </div>

            {isOpen && (
                <div className={styles.viewer} onClick={close} role="dialog" aria-modal="true">
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
