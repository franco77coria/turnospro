// Helper to send emails from client/server components

export async function sendEmail({ type, to, data }) {
    try {
        const res = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, to, data }),
        })

        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Error al enviar email')
        return result
    } catch (err) {
        console.error('sendEmail error:', err)
        return { error: err.message }
    }
}

// Send confirmation email when appointment is created
export async function sendAppointmentConfirmation({ appointment, client, business, service, professional }) {
    if (!client?.email) return { error: 'Cliente sin email' }

    const date = new Date(appointment.date)
    const formattedDate = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'confirmation',
        to: client.email,
        data: {
            clientName: client.name || 'Cliente',
            serviceName: service?.name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            duration: service?.duration || appointment.duration,
            professional: professional?.name || appointment.professional,
            businessName: business?.name || 'TurnosPro',
            businessType: business?.business_type || 'custom',
            businessPhone: business?.phone,
            appointmentUrl: `https://turnospro-omega.vercel.app/dashboard/appointments`,
        }
    })
}

// Send reminder email
export async function sendAppointmentReminder({ appointment, client, business, service, hoursUntil }) {
    if (!client?.email) return { error: 'Cliente sin email' }

    const date = new Date(appointment.date)
    const formattedDate = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    return sendEmail({
        type: 'reminder',
        to: client.email,
        data: {
            clientName: client.name || 'Cliente',
            serviceName: service?.name || appointment.service || 'Turno',
            date: formattedDate,
            time: appointment.time,
            hoursUntil: hoursUntil || 24,
            businessName: business?.name || 'TurnosPro',
            businessType: business?.business_type || 'custom',
            businessPhone: business?.phone,
            appointmentUrl: `https://turnospro-omega.vercel.app/dashboard/appointments`,
        }
    })
}
