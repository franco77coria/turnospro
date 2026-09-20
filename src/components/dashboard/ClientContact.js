'use client'

/**
 * Datos de contacto del cliente y acceso directo a WhatsApp desde el turno.
 *
 * El dueño veía solo el nombre del cliente en la fila del turno. Para
 * confirmar una asistencia tenía que abrir el perfil, copiar el teléfono,
 * salir a WhatsApp y escribir el mensaje a mano — y eso es algo que hace
 * varias veces por día.
 */

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Phone, Mail, ChevronDown } from 'lucide-react'
import { buildWhatsAppLink } from '@/lib/business-profile'
import { mensajeParaCliente, TIPOS_DE_MENSAJE } from '@/lib/client-contact'
import { formatPhoneDisplay } from '@/lib/phone-validation'
import styles from './ClientContact.module.css'

/**
 * @param {object}  props
 * @param {object}  props.appointment  turno, con `clients` embebido
 * @param {string}  props.businessName
 * @param {boolean} [props.compact]    solo el botón, para filas apretadas
 */
export default function ClientContact({ appointment, businessName, compact = false }) {
    const [abierto, setAbierto] = useState(false)
    const ref = useRef(null)

    const cliente = appointment?.clients || {}
    const telefono = cliente.phone

    useEffect(() => {
        if (!abierto) return
        const alClickear = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
        }
        const alEscapar = (e) => { if (e.key === 'Escape') setAbierto(false) }
        document.addEventListener('mousedown', alClickear)
        document.addEventListener('keydown', alEscapar)
        return () => {
            document.removeEventListener('mousedown', alClickear)
            document.removeEventListener('keydown', alEscapar)
        }
    }, [abierto])

    const datos = {
        clientName: cliente.name,
        businessName,
        serviceName: appointment?.service_name,
        date: appointment?.date,
        time: appointment?.time,
    }

    const abrirWhatsApp = (tipo) => {
        const link = buildWhatsAppLink(telefono, mensajeParaCliente(tipo, datos))
        if (link) window.open(link, '_blank', 'noopener,noreferrer')
        setAbierto(false)
    }

    // Sin teléfono no hay nada que ofrecer, y un botón que no hace nada
    // confunde más que la ausencia del botón.
    if (!telefono || !buildWhatsAppLink(telefono)) {
        if (compact) return null
        return (
            <span className={styles.sinTelefono} title="Este cliente no dejó teléfono">
                Sin teléfono
            </span>
        )
    }

    return (
        <div className={styles.contenedor} ref={ref}>
            {!compact && (
                <div className={styles.datos}>
                    <a href={`tel:${telefono}`} className={styles.dato}>
                        <Phone size={12} aria-hidden="true" />
                        {formatPhoneDisplay(telefono) || telefono}
                    </a>
                    {cliente.email && (
                        <a href={`mailto:${cliente.email}`} className={styles.dato} title={cliente.email}>
                            <Mail size={12} aria-hidden="true" />
                            <span className={styles.email}>{cliente.email}</span>
                        </a>
                    )}
                </div>
            )}

            <div className={styles.grupoBoton}>
                {/* Un solo clic hace lo más frecuente: confirmar. El resto
                    queda en el desplegable, sin sumar pasos al caso común. */}
                <button
                    type="button"
                    className={styles.botonWhatsApp}
                    onClick={() => abrirWhatsApp('confirmar')}
                    title={`Escribirle a ${cliente.name || 'el cliente'} por WhatsApp`}
                >
                    <MessageCircle size={14} aria-hidden="true" />
                    <span className={styles.etiqueta}>WhatsApp</span>
                </button>
                <button
                    type="button"
                    className={styles.botonDesplegar}
                    onClick={() => setAbierto((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={abierto}
                    aria-label="Elegir otro mensaje"
                >
                    <ChevronDown size={13} aria-hidden="true" />
                </button>

                {abierto && (
                    <div className={styles.menu} role="menu">
                        {TIPOS_DE_MENSAJE.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="menuitem"
                                className={styles.opcion}
                                onClick={() => abrirWhatsApp(t.id)}
                            >
                                {t.etiqueta}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
