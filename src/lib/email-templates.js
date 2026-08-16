// Email HTML templates para TU GLOWUP
// Diseño idéntico a la Web App: paleta Cream (#FFF6F0), Ink (#1A0E1F), Pink (#FF2E8E) y Violet (#6E2BFF).

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

function baseLayout(content, businessName) {
    const safeBiz = escapeHtml(businessName)
    const initial = safeBiz ? safeBiz[0].toUpperCase() : 'G'
    const appHref = safeUrl(process.env.NEXT_PUBLIC_APP_URL || 'https://tu-glowup.com')

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu GlowUp</title>
</head>
<body style="margin:0;padding:0;background-color:#FFF6F0;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#1A0E1F;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF6F0;padding:40px 16px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;border:1px solid #ECE0E8;box-shadow:0 12px 30px rgba(26, 14, 31, 0.08);overflow:hidden;">

                    <!-- Encabazado Estilo Web GLOWUP (Rosa a Violeta) -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #FF2E8E 0%, #6E2BFF 100%);padding:28px 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <table cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="width:44px;height:44px;background:#ffffff;border-radius:14px;text-align:center;vertical-align:middle;color:#FF2E8E;font-size:22px;font-weight:900;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                                                    ${initial}
                                                </td>
                                                <td style="padding-left:14px;">
                                                    <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;display:block;line-height:1.2;">
                                                        ${safeBiz}
                                                    </span>
                                                    <span style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;">
                                                        Reserva Online
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td align="right" style="vertical-align:middle;">
                                        <span style="background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;padding:6px 14px;border-radius:999px;backdrop-filter:blur(4px);">
                                            GLOWUP
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Contenido Principal -->
                    <tr>
                        <td style="padding:32px 32px 24px;background:#ffffff;">
                            ${content}
                        </td>
                    </tr>

                    <!-- Pie de página Estilo Web -->
                    <tr>
                        <td style="padding:24px 32px;border-top:1px solid #F5EAF0;background-color:#FBEDE2;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <p style="margin:0 0 6px;font-size:13px;color:#6B5E76;font-weight:600;">
                                            Enviado por <strong>${safeBiz}</strong> a través de
                                            <a href="${appHref}" style="color:#FF2E8E;font-weight:800;text-decoration:none;">GLOWUP</a>
                                        </p>
                                        <p style="margin:0;font-size:11px;color:#AAA0B5;">
                                            Gestión de turnos y agenda online 24/7.
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

export function confirmationEmail({ clientName, serviceName, date, time, duration, professional, businessName, businessPhone, appointmentUrl, cancelUrl }) {
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
        <!-- Badge de Confirmación Estilo Mint -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td style="background:#B9F7E2;color:#008C66;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;display:inline-block;">
                    ✓ TURNO CONFIRMADO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            ¡Todo listo para tu visita!
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.5;">
            Hola <strong style="color:#1A0E1F;">${c.clientName}</strong>, tu turno fue agendado exitosamente en <strong>${escapeHtml(businessName)}</strong>.
        </p>

        <!-- Tarjeta de Detalles -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6F0;border-radius:18px;border:1px solid #ECE0E8;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:16px;border-bottom:1px solid #ECE0E8;">
                                <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Servicio</span><br>
                                <span style="font-size:18px;font-weight:800;color:#1A0E1F;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%" style="vertical-align:top;">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">📅 Fecha</span><br>
                                            <span style="font-size:15px;font-weight:800;color:#1A0E1F;display:inline-block;margin-top:2px;">${c.date}</span>
                                        </td>
                                        <td width="50%" style="vertical-align:top;">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">🕒 Hora</span><br>
                                            <span style="font-size:15px;font-weight:800;color:#FF2E8E;display:inline-block;margin-top:2px;">${c.time} hs</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        ${c.duration || c.professional ? `
                        <tr>
                            <td style="padding-top:16px;border-top:1px solid #ECE0E8;margin-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        ${c.duration ? `
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Duración</span><br>
                                            <span style="font-size:14px;font-weight:700;color:#3A2845;">${c.duration} min</span>
                                        </td>` : ''}
                                        ${c.professional ? `
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Atendido por</span><br>
                                            <span style="font-size:14px;font-weight:700;color:#3A2845;">${c.professional}</span>
                                        </td>` : ''}
                                    </tr>
                                </table>
                            </td>
                        </tr>` : ''}
                    </table>
                </td>
            </tr>
        </table>

        <!-- Botón Principal Rosa GlowUp -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
            <tr>
                <td align="center">
                    ${c.appointmentUrl ? `
                    <a href="${c.appointmentUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Ver mi turno en Tu GlowUp
                    </a>` : ''}
                </td>
            </tr>
        </table>

        ${c.cancelUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.cancelUrl}" style="display:inline-block;color:#6B5E76;text-decoration:none;padding:8px 16px;font-size:12px;font-weight:600;">
                        ¿Necesitás cancelar? Hacé clic acá
                    </a>
                </td>
            </tr>
        </table>` : ''}

        ${c.businessPhone ? `
        <p style="margin:20px 0 0;font-size:13px;color:#6B5E76;text-align:center;">
            ¿Dudas o consultas? Contactanos al <strong style="color:#1A0E1F;">${c.businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, businessName)
}

export function reminderEmail({ clientName, serviceName, date, time, hoursUntil, businessName, businessPhone, appointmentUrl }) {
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
                <td style="background:#FFF1B0;color:#B47E00;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;display:inline-block;">
                    ⏰ RECORDATORIO DE TURNO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            Tu turno es muy pronto
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.5;">
            Hola <strong>${c.clientName}</strong>, te recordamos que tenés un turno reservado en <strong>${escapeHtml(businessName)}</strong>
            ${safeHours <= 1 ? '<strong style="color:#FF2E8E;">en menos de 1 hora</strong>' : `en <strong>${safeHours} horas</strong>`}.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #FF2E8E 0%, #6E2BFF 100%);border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 12px 30px rgba(110, 43, 255, 0.25);">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.2);">
                                <span style="font-size:11px;font-weight:800;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.06em;">Servicio</span><br>
                                <span style="font-size:18px;font-weight:800;color:#ffffff;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.06em;">Fecha</span><br>
                                            <span style="font-size:16px;font-weight:800;color:#ffffff;">${c.date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.06em;">Hora</span><br>
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
                    <a href="${c.appointmentUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Ver mi turno en Tu GlowUp
                    </a>
                </td>
            </tr>
        </table>` : ''}

        ${c.businessPhone ? `
        <p style="margin:20px 0 0;font-size:13px;color:#6B5E76;text-align:center;">
            ¿No podés asistir? Avisanos al <strong style="color:#1A0E1F;">${c.businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, businessName)
}

export function welcomeEmail({ clientName, businessName, webUrl }) {
    const c = {
        clientName: escapeHtml(clientName),
        webUrl: webUrl ? safeUrl(webUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            ¡Bienvenido/a a Tu GlowUp! 🎉
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.6;">
            Hola <strong>${c.clientName}</strong>, tu cuenta fue registrada exitosamente en <strong>${escapeHtml(businessName)}</strong>. A partir de ahora podés reservar turnos online en 3 clics y recibirás notificaciones por email.
        </p>

        ${c.webUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
                <td align="center">
                    <a href="${c.webUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Reservar mi primer turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}

export function newBookingNotifyEmail({ clientName, clientEmail, clientPhone, serviceName, date, time, duration, businessName, dashboardUrl }) {
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
                <td style="background:#F0E9FF;color:#5418D6;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;display:inline-block;">
                    🔔 NUEVA RESERVA EN TU AGENDA
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            Tenés un nuevo turno agendado
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.5;">
            El cliente <strong style="color:#1A0E1F;">${c.clientName}</strong> reservó un turno en <strong>${escapeHtml(businessName)}</strong>.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF6F0;border-radius:18px;border:1px solid #ECE0E8;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:16px;border-bottom:1px solid #ECE0E8;">
                                <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Servicio</span><br>
                                <span style="font-size:18px;font-weight:800;color:#1A0E1F;display:inline-block;margin-top:2px;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Fecha</span><br>
                                            <span style="font-size:15px;font-weight:800;color:#1A0E1F;">${c.date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Hora</span><br>
                                            <span style="font-size:15px;font-weight:800;color:#FF2E8E;">${c.time} hs</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:16px;border-top:1px solid #ECE0E8;margin-top:14px;">
                                <span style="font-size:11px;font-weight:800;color:#6B5E76;text-transform:uppercase;letter-spacing:0.06em;">Datos del cliente</span><br>
                                <span style="font-size:14px;font-weight:800;color:#1A0E1F;">${c.clientName}</span><br>
                                ${c.clientEmail ? `<span style="font-size:13px;color:#6B5E76;">${c.clientEmail}</span><br>` : ''}
                                ${c.clientPhone ? `<span style="font-size:13px;color:#6B5E76;">${c.clientPhone}</span>` : ''}
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
                    <a href="${c.dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Ver en mi Dashboard
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}

export function cancellationEmail({ clientName, serviceName, date, time, businessName, businessPhone, bookUrl }) {
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
                <td style="background:#FFE9F2;color:#E6157A;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;display:inline-block;">
                    ✕ TURNO CANCELADO
                </td>
            </tr>
        </table>

        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            Tu turno fue cancelado
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.5;">
            Hola <strong>${c.clientName}</strong>, tu reserva en <strong>${escapeHtml(businessName)}</strong> fue cancelada.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFE9F2;border-radius:18px;border:1px solid #FFD7E8;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="font-size:11px;font-weight:800;color:#E6157A;text-transform:uppercase;letter-spacing:0.06em;">Servicio cancelado</span><br>
                                <span style="font-size:18px;font-weight:800;color:#E6157A;text-decoration:line-through;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:800;color:#E6157A;text-transform:uppercase;letter-spacing:0.06em;">Fecha y Hora</span><br>
                                <span style="font-size:15px;color:#E6157A;text-decoration:line-through;">${c.date} — ${c.time} hs</span>
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
                    <a href="${c.bookUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Reservar un nuevo turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}

export function cancellationNotifyEmail({ clientName, clientEmail, serviceName, date, time, businessName, dashboardUrl }) {
    const c = {
        clientName: escapeHtml(clientName),
        clientEmail: escapeHtml(clientEmail),
        serviceName: escapeHtml(serviceName),
        date: escapeHtml(date),
        time: escapeHtml(time),
        dashboardUrl: dashboardUrl ? safeUrl(dashboardUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#E6157A;letter-spacing:-0.02em;">
            Turno cancelado por el cliente
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.5;">
            El cliente <strong>${c.clientName}</strong> canceló su reserva en tu agenda.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFE9F2;border-radius:18px;border:1px solid #FFD7E8;padding:24px;margin-bottom:24px;">
            <tr>
                <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="font-size:11px;font-weight:800;color:#E6157A;text-transform:uppercase;">Servicio</span><br>
                                <span style="font-size:16px;font-weight:800;color:#E6157A;">${c.serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:800;color:#E6157A;text-transform:uppercase;">Fecha liberada</span><br>
                                <span style="font-size:15px;font-weight:800;color:#1A0E1F;">${c.date} — ${c.time} hs</span>
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
                    <a href="${c.dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Ver agenda en el Dashboard
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}

export function reviewRequestEmail({ clientName, serviceName, businessName, reviewUrl }) {
    const c = {
        clientName: escapeHtml(clientName),
        serviceName: escapeHtml(serviceName || 'turno'),
        reviewUrl: reviewUrl ? safeUrl(reviewUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            ¿Cómo fue tu experiencia? ⭐
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.6;">
            Hola <strong>${c.clientName}</strong>, gracias por visitarnos en <strong>${escapeHtml(businessName)}</strong>. Tu opinión nos ayuda a mejorar día a día. ¿Podrías dejarnos una breve reseña de tu ${c.serviceName}?
        </p>

        ${c.reviewUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.reviewUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Dejar mi opinión
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}

export function waitlistSlotEmail({ clientName, serviceName, date, businessName, bookUrl }) {
    const c = {
        clientName: escapeHtml(clientName || 'Hola'),
        serviceName: escapeHtml(serviceName || 'turno'),
        date: escapeHtml(date || ''),
        bookUrl: bookUrl ? safeUrl(bookUrl) : null,
    }

    const content = `
        <h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#1A0E1F;letter-spacing:-0.02em;">
            Se liberó un turno 🎉
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#6B5E76;line-height:1.6;">
            Hola <strong>${c.clientName}</strong>, se liberó un lugar para <strong>${c.serviceName}</strong>
            el <strong>${c.date}</strong> en <strong>${escapeHtml(businessName || 'el negocio')}</strong>.
            Estabas en la lista de espera, así que te avisamos primero. Reservalo antes de que lo tome otra persona.
        </p>

        ${c.bookUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${c.bookUrl}" style="display:inline-block;background:linear-gradient(135deg, #FF2E8E 0%, #E6157A 100%);color:#ffffff;text-decoration:none;padding:15px 36px;border-radius:999px;font-size:15px;font-weight:800;box-shadow:0 8px 20px rgba(255, 46, 142, 0.35);">
                        Reservar ahora
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, businessName)
}
