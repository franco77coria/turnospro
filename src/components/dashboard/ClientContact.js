'use client'

import { Mail, Phone } from 'lucide-react'
import { mensajeParaCliente } from '@/lib/client-contact'
import { formatPhoneDisplay } from '@/lib/phone-validation'
import styles from './ClientContact.module.css'

/** Contacto manual del negocio: abre el cliente de correo, no envía en silencio. */
export default function ClientContact({ appointment, businessName, compact = false }) {
    const client = appointment?.clients || {}
    const data = {
        clientName: client.name, businessName,
        serviceName: appointment?.service_name, date: appointment?.date, time: appointment?.time,
    }
    if (!client.email && compact) return null
    const mailto = client.email && `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Tu turno en ${businessName || 'GLOWUP'}`)}&body=${encodeURIComponent(mensajeParaCliente('confirmar', data))}`
    return <div className={styles.contenedor}>
        {!compact && <div className={styles.datos}>
            {client.phone && <a href={`tel:${client.phone}`} className={styles.dato}><Phone size={12}/>{formatPhoneDisplay(client.phone) || client.phone}</a>}
            {client.email && <span className={styles.dato}><Mail size={12}/><span className={styles.email}>{client.email}</span></span>}
        </div>}
        {mailto ? <a href={mailto} className={styles.botonEmail}><Mail size={14}/> <span className={styles.etiqueta}>Email</span></a>
            : <span className={styles.sinEmail}>Sin email</span>}
    </div>
}
