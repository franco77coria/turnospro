'use client'

import { Mail, MessageCircle, Phone } from 'lucide-react'
import { mensajeParaCliente } from '@/lib/client-contact'
import { buildWhatsAppLink } from '@/lib/business-profile'
import { formatPhoneDisplay } from '@/lib/phone-validation'
import styles from './ClientContact.module.css'

/** Contacto manual del negocio: abre WhatsApp o el cliente de correo, sin enviar en silencio. */
export default function ClientContact({ appointment, businessName, compact = false }) {
    const client = appointment?.clients || {}
    const data = {
        clientName: client.name, businessName,
        serviceName: appointment?.service_name, date: appointment?.date, time: appointment?.time,
    }
    const message = mensajeParaCliente('confirmar', data)
    const whatsapp = buildWhatsAppLink(client.phone, message)
    const mailto = client.email && `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Tu turno en ${businessName || 'GLOWUP'}`)}&body=${encodeURIComponent(message)}`
    if (!whatsapp && !mailto && compact) return null

    return <div className={styles.contenedor}>
        {!compact && <div className={styles.datos}>
            {client.phone && <a href={`tel:${client.phone}`} className={styles.dato}><Phone size={12}/>{formatPhoneDisplay(client.phone) || client.phone}</a>}
            {client.email && <span className={styles.dato}><Mail size={12}/><span className={styles.email}>{client.email}</span></span>}
        </div>}
        <div className={styles.acciones}>
            {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={styles.botonWhatsApp} aria-label={`Escribirle a ${client.name || 'cliente'} por WhatsApp`}>
                    <MessageCircle size={14} /> <span className={styles.etiqueta}>WhatsApp</span>
                </a>
            )}
            {mailto && (
                <a href={mailto} className={styles.botonEmail} aria-label={`Escribirle a ${client.name || 'cliente'} por email`}>
                    <Mail size={14} /> <span className={styles.etiqueta}>Email</span>
                </a>
            )}
            {!whatsapp && !mailto && <span className={styles.sinContacto}>Sin datos de contacto</span>}
        </div>
    </div>
}
