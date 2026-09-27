'use client'

import { useEffect, useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { dibujarFlyer, FORMATOS } from '@/lib/flyer'

const exampleUrl = 'https://www.tu-glowup.com/explore'

export default function FlyerShowcase() {
    const canvasRef = useRef(null)
    const qrRef = useRef(null)

    useEffect(() => {
        let active = true
        const image = new window.Image()
        const paint = (coverImage = null) => {
            if (!active || !canvasRef.current) return
            const canvas = canvasRef.current
            canvas.width = FORMATOS.feed.ancho
            canvas.height = FORMATOS.feed.alto
            const styles = getComputedStyle(document.documentElement)
            dibujarFlyer(canvas.getContext('2d'), {
                nombreNegocio: 'BARBERÍA CENTRAL',
                fechaTexto: 'Hoy',
                horarios: ['10:30', '12:00', '17:30', '19:00'].map(time => ({ time, available: true })),
                enlace: exampleUrl,
                esHoy: true,
                qrCanvas: qrRef.current,
                colorPrimario: '#FA4B20',
                colorSecundario: '#3122A5',
                coverImage,
            }, FORMATOS.feed, {
                display: `${styles.getPropertyValue('--font-bricolage').trim() || 'sans-serif'}, sans-serif`,
                cuerpo: `${styles.getPropertyValue('--font-jakarta').trim() || 'sans-serif'}, sans-serif`,
            })
        }

        Promise.resolve(document.fonts?.ready).then(() => {
            if (!active) return
            image.onload = () => paint(image)
            image.onerror = () => paint()
            image.src = '/barberia-ejemplo.webp'
        })

        return () => { active = false; image.onload = null; image.onerror = null }
    }, [])

    return (
        <div className="gu-flyer-showcase">
            <div className="gu-flyer-showcase-head">
                <span>Compartí tus horarios de hoy</span>
                <span>Publicación o historia</span>
            </div>
            <canvas ref={canvasRef} className="gu-flyer-showcase-canvas" role="img" aria-label="Ejemplo de flyer de barbería con cuatro horarios libres" />
            <p>Ejemplo ilustrativo. Tu flyer muestra los turnos libres y la portada de tu negocio.</p>
            <div className="gu-flyer-showcase-qr" aria-hidden="true"><QRCodeCanvas value={exampleUrl} size={180} ref={qrRef} /></div>
        </div>
    )
}
