'use client'
import { useState, useEffect } from 'react'
import { X, Download, Share, PlusSquare } from 'lucide-react'
import styles from './InstallPrompt.module.css'

export default function InstallPrompt() {
    const [isInstallable, setIsInstallable] = useState(false)
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [showiOSPrompt, setShowiOSPrompt] = useState(false)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        // Verificar si ya fue descartado antes
        if (typeof window !== 'undefined' && localStorage.getItem('hideInstallPrompt') === 'true') {
            return
        }

        // Detectar si ya está instalada (Standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
        if (isStandalone) return

        // Chrome/Android listener
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
            setIsInstallable(true)
            setVisible(true)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        // Detectar iOS Safari para mostrar banner manual
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

        if (isIOS && isSafari && !isStandalone) {
            setShowiOSPrompt(true)
            setVisible(true)
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }, [])

    const handleInstallClick = async () => {
        if (!deferredPrompt) return

        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            setVisible(false)
        }
        setDeferredPrompt(null)
    }

    const dismissPrompt = () => {
        setVisible(false)
        localStorage.setItem('hideInstallPrompt', 'true')
    }

    if (!visible) return null

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <button onClick={dismissPrompt} className={styles.closeBtn} aria-label="Cerrar">
                    <X size={18} />
                </button>
                
                <div className={styles.iconWrap}>
                    <Download size={24} />
                </div>
                
                <h3>Instalá la App de GLOWUP</h3>
                
                {isInstallable && (
                    <>
                        <p>Reservá mucho más rápido y recibí recordatorios directo en tu celu.</p>
                        <button onClick={handleInstallClick} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                            Instalar App
                        </button>
                    </>
                )}
                
                {showiOSPrompt && (
                    <>
                        <p>Para la mejor experiencia, instalá GLOWUP en tu iPhone:</p>
                        <ol className={styles.iosSteps}>
                            <li>Tocá <Share size={14} style={{ display: 'inline', margin: '0 4px', verticalAlign: 'middle' }} /> en el menú inferior</li>
                            <li>Buscá <PlusSquare size={14} style={{ display: 'inline', margin: '0 4px', verticalAlign: 'middle' }} /> <strong>Agregar a inicio</strong></li>
                        </ol>
                    </>
                )}
            </div>
        </div>
    )
}
