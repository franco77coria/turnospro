// Templates de Email HTML para TU GLOWUP
// Diseño ultra-premium, moderno, responsivo y adaptado al rubro comercial.

export function escapeHtml(value) {
    if (value == null) return ''
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function safeUrl(value) {
    if (!value) return '#'
    try {
        const u = new URL(String(value))
        if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return '#'
        return escapeHtml(u.toString())
    } catch {
        return '#'
    }
}

const RUBRO_THEMES = {
    barberia: { accent: '#0F172A', gradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', name: 'Barbería', icon: '✂️' },
    peluqueria: { accent: '#7C3AED', gradient: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)', name: 'Peluquería', icon: '💇' },
    unas: { accent: '#EC4899', gradient: 'linear-gradient(135deg, #DB2777 0%, #F472B6 100%)', name: 'Uñas', icon: '💅' },
    lash: { accent: '#8B5CF6', gradient: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)', name: 'Lash & Cejas', icon: '👁️' },
    spa: { accent: '#0D9488', gradient: 'linear-gradient(135deg, #0F766E 0%, #2DD4BF 100%)', name: 'Spa & Estética', icon: '🧖' },
    consultorio: { accent: '#0284C7', gradient: 'linear-gradient(135deg, #0369A1 0%, #38BDF8 100%)', name: 'Consultorio', icon: '🏥' },
    veterinaria: { accent: '#16A34A', gradient: 'linear-gradient(135deg, #15803D 0%, #4ADE80 100%)', name: 'Veterinaria', icon: '🐾' },
    custom: { accent: '#4F46E5', gradient: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', name: 'Servicios', icon: '🏢' },
}

function getTheme(businessType) {
    return RUBRO_THEMES[businessType] || RUBRO_THEMES.custom
}

function baseLayout(content, theme, businessName) {
    const safeBiz = escapeHtml(businessName)
    const initial = safeBiz ? safeBiz[0].toUpperCase() : 'G'
    const appHref = safeUrl(process.env.NEXT_PUBLIC_APP_URL || 'https://tu-glowup.com')

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu GlowUp</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:32px 16px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:20px;border:1px solid #E2E8F0;box-shadow:0 10px 30px rgba(0,0,0,0.06);overflow:hidden;">

                    <!-- Entezado Premium -->
                    <tr>
                        <td style="background:${theme.gradient};padding:32px 32px 28px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <table cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;text-align:center;vertical-align:middle;color:#ffffff;font-size:20px;font-weight:800;border:1px solid rgba(255,255,255,0.3);">
                                                    ${initial}
                                                </td>
                                                <td style="padding-left:14px;">
                                                    <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;display:block;line-height:1.2;">
                                                        ${safeBiz}
                                                    </span>
                                                    <span style="color:rgba(255,255,255,0.75);font-size:12px;font-weight:500;">
                                                        ${theme.icon} ${theme.name}
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td align="right" style="vertical-align:top;">
                                        <span style="background:rgba(255,255,255,0.15);color:#ffffff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);">
                                            TU GLOWUP
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Contenido Principal -->
                    <tr>
                        <td style="padding:32px 32px 24px;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Pie de página -->
                    <tr>
                        <td style="padding:24px 32px;border-top:1px solid #F1F5F9;background-color:#F8FAFC;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <p style="margin:0 0 6px;font-size:12px;color:#64748B;font-weight:500;">
                                            Enviado por <strong>${safeBiz}</strong> a través de
                                            <a href="${appHref}" style="color:${theme.accent};font-weight:700;text-decoration:none;">Tu GlowUp</a>
                                        </p>
                                        <p style="margin:0;font-size:11px;color:#94A3B8;">
                                            Agenda online y gestión de turnos 24/7.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
}

export function confirmationEmail({ clientName, serviceName, date, time, duration, professional, businessName, businessType, businessPhone, appointmentUrl, cancelUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        duration: duration != null ? escapeHtml(duration) : null,
        professional: escapeHtml(professional),
        businessPhone: escapeHtml(businessPhone),
        appointmentUrl: appointmentUrl ? safeUrl(appointmentUrl) : null,
        cancelUrl: cancelUrl ? safeUrl(cancelUrl) : null,
    }

    const content = `
        <!-- Badge Estado -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td style="background:#ECFDF5;border:1px solid #A7F3D0;color:#047857;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;">
                    ✓ TURNO CONFIRMADO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            ¡Todo listo para tu visita!
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            Hola <strong style="color:#0F172A;">${c.clientName}</strong>, tu reserva fue agendada exitosamente en <strong>${escapeHtml(businessName)}</strong>.
        </p>

        <!-- Tarjeta de Detalles del Turno -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:16px;border:1px solid #E2E8F0;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:16px;border-bottom:1px solid #E2E8F0;">
                                <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Servicio contratado</span><br>
                                <span style="font-size:18px;font-weight:800;color:#0F172A;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%" style="vertical-align:top;">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">📅 Fecha</span><br>
                                            <span style="font-size:15px;font-weight:700;color:#0F172A;display:inline-block;margin-top:2px;">${c.date}</span>
                                        </td>
                                        <td width="50%" style="vertical-align:top;">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">🕒 Hora</span><br>
                                            <span style="font-size:15px;font-weight:700;color:#0F172A;display:inline-block;margin-top:2px;">${c.time} hs</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        ${c.duration || c.professional ? `
                        <tr>
                            <td style="padding-top:16px;border-top:1px solid #E2E8F0;margin-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        ${c.duration ? `
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Duración</span><br>
                                            <span style="font-size:14px;font-weight:600;color:#475569;">${c.duration} min</span>
                                        </td>` : ''}
                                        ${c.professional ? `
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Atendido por</span><br>
                                            <span style="font-size:14px;font-weight:600;color:#475569;">${c.professional}</span>
                                        </td>` : ''}
                                    </tr>
                                </table>
                            </td>
                        </tr>` : ''}
                    </table>
                </td>
            </tr>
        </table>

        <!-- Botones de Acción -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td align="center">
                    ${c.appointmentUrl ? `
                    <a href="${c.appointmentUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(15,23,42,0.18);">
                        Ver mi turno en Tu GlowUp
                    </a>` : ''}
                </td>
            </tr>
        </table>

        ${c.cancelUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.cancelUrl}" style="display:inline-block;color:#94A3B8;text-decoration:none;padding:8px 16px;font-size:12px;font-weight:500;">
                        ¿Necesitás cancelar? Hacé clic acá
                    </a>
                </td>
            </tr>
        </table>` : ''}

        ${c.businessPhone ? `
        <p style="margin:20px 0 0;font-size:13px;color:#64748B;text-align:center;">
            ¿Dudas o consultas? Contactanos al <strong style="color:#0F172A;">${c.businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function reminderEmail({ clientName, serviceName, date, time, hoursUntil, businessName, businessType, businessPhone, appointmentUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        businessPhone: escapeHtml(businessPhone),
        appointmentUrl: appointmentUrl ? safeUrl(appointmentUrl) : null,
    }
    const safeHours = Number.isFinite(hoursUntil) ? Math.max(0, Math.floor(hoursUntil)) : 0

    const content = `
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td style="background:#FFFBEB;border:1px solid #FDE68A;color:#B45309;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;">
                    ⏰ RECORDATORIO PRÓXIMO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            Tu turno es muy pronto
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            Hola <strong>${c.clientName}</strong>, te recordamos que tenés un turno reservado en <strong>${escapeHtml(businessName)}</strong>
            ${safeHours <= 1 ? '<strong style="color:#D97706;">en menos de 1 hora</strong>' : `en <strong>${safeHours} horas</strong>`}.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:${theme.gradient};border-radius:16px;padding:24px;margin-bottom:24px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.2);">
                                <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">Servicio</span><br>
                                <span style="font-size:18px;font-weight:800;color:#ffffff;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">Fecha</span><br>
                                            <span style="font-size:16px;font-weight:800;color:#ffffff;">${c.date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.06em;">Hora</span><br>
                                            <span style="font-size:16px;font-weight:800;color:#ffffff;">${c.time} hs</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        ${c.appointmentUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.appointmentUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(15,23,42,0.18);">
                        Ver mi turno
                    </a>
                </td>
            </tr>
        </table>` : ''}

        ${c.businessPhone ? `
        <p style="margin:20px 0 0;font-size:13px;color:#64748B;text-align:center;">
            ¿No podés asistir? Avisanos al <strong style="color:#0F172A;">${c.businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function welcomeEmail({ clientName, businessName, businessType, webUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        webUrl: webUrl ? safeUrl(webUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            ¡Bienvenido/a!
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
            Hola <strong>${c.clientName}</strong>, tu cuenta fue registrada exitosamente en <strong>${escapeHtml(businessName)}</strong>. A partir de ahora podés reservar turnos online en segundos y recibirás notificaciones en tiempo real por email.
        </p>

        ${c.webUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
                <td align="center">
                    <a href="${c.webUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;">
                        Reservar mi primer turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function newBookingNotifyEmail({ clientName, clientEmail, clientPhone, serviceName, date, time, duration, businessName, businessType, dashboardUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        clientEmail: escapeHtml(clientEmail),
        clientPhone: escapeHtml(clientPhone),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        duration: duration != null ? escapeHtml(duration) : null,
        dashboardUrl: dashboardUrl ? safeUrl(dashboardUrl) : null,
    }

    const content = `
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td style="background:#EFF6FF;border:1px solid #BFDBFE;color:#1D4ED8;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;">
                    🔔 NUEVA RESERVA RECIBIDA
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            Tenés un nuevo turno agendado
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            El cliente <strong style="color:#0F172A;">${c.clientName}</strong> reservó un turno en <strong>${escapeHtml(businessName)}</strong>.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:16px;border:1px solid #E2E8F0;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:14px;border-bottom:1px solid #E2E8F0;">
                                <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Servicio</span><br>
                                <span style="font-size:17px;font-weight:800;color:#0F172A;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Fecha</span><br>
                                            <span style="font-size:15px;font-weight:700;color:#0F172A;">${c.date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Hora</span><br>
                                            <span style="font-size:15px;font-weight:700;color:#0F172A;">${c.time} hs</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;border-top:1px solid #E2E8F0;margin-top:14px;">
                                <span style="font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Datos del cliente</span><br>
                                <span style="font-size:14px;font-weight:700;color:#0F172A;">${c.clientName}</span><br>
                                ${c.clientEmail ? `<span style="font-size:13px;color:#64748B;">${c.clientEmail}</span><br>` : ''}
                                ${c.clientPhone ? `<span style="font-size:13px;color:#64748B;">${c.clientPhone}</span>` : ''}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        ${c.dashboardUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.dashboardUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(15,23,42,0.18);">
                        Ver en mi Dashboard
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function cancellationEmail({ clientName, serviceName, date, time, businessName, businessType, businessPhone, bookUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        businessPhone: escapeHtml(businessPhone),
        bookUrl: bookUrl ? safeUrl(bookUrl) : null,
    }

    const content = `
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td style="background:#FEF2F2;border:1px solid #FECACA;color:#DC2626;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block;">
                    ✕ TURNO CANCELADO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            Tu turno fue cancelado
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            Hola <strong>${c.clientName}</strong>, tu reserva en <strong>${escapeHtml(businessName)}</strong> fue cancelada.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border-radius:16px;border:1px solid #FECACA;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.06em;">Servicio cancelado</span><br>
                                <span style="font-size:17px;font-weight:700;color:#DC2626;text-decoration:line-through;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.06em;">Fecha y Hora</span><br>
                                <span style="font-size:15px;color:#991B1B;text-decoration:line-through;">${c.date} — ${c.time} hs</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        ${c.bookUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.bookUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;">
                        Reservar un nuevo turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function cancellationNotifyEmail({ clientName, clientEmail, serviceName, date, time, businessName, businessType, dashboardUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        clientEmail: escapeHtml(clientEmail),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        dashboardUrl: dashboardUrl ? safeUrl(dashboardUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#DC2626;letter-spacing:-0.02em;">
            Turno cancelado por el cliente
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.5;">
            El cliente <strong>${c.clientName}</strong> canceló su reserva en tu agenda.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border-radius:16px;border:1px solid #FECACA;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;">Servicio</span><br>
                                <span style="font-size:16px;font-weight:700;color:#DC2626;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;">Fecha liberada</span><br>
                                <span style="font-size:15px;font-weight:700;color:#0F172A;">${c.date} — ${c.time} hs</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        ${c.dashboardUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.dashboardUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:14px;font-weight:700;">
                        Ver agenda en el Dashboard
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function reviewRequestEmail({ clientName, serviceName, businessName, businessType, reviewUrl }) {
    const theme = getTheme(businessType)
    const c = {
        clientName: escapeHtml(clientName),
        serviceName: escapeHtml(serviceName || 'turno'),
        reviewUrl: reviewUrl ? safeUrl(reviewUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;">
            ¿Cómo fue tu experiencia? ⭐
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
            Hola <strong>${c.clientName}</strong>, gracias por visitarnos en <strong>${escapeHtml(businessName)}</strong>. Tu opinión es súper importante para nosotros. ¿Podrías dejarnos una breve reseña de tu ${c.serviceName}?
        </p>

        ${c.reviewUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.reviewUrl}" style="display:inline-block;background:${theme.gradient};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:15px;font-weight:700;box-shadow:0 4px 14px rgba(15,23,42,0.18);">
                        Dejar mi opinión
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}
