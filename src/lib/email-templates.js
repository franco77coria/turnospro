// Email HTML templates for GLOWUP
// Minimalist, professional, themed by business type

const RUBRO_THEMES = {
    barberia: { accent: '#1E293B', name: 'Barbería', icon: '✂️' },
    peluqueria: { accent: '#7C3AED', name: 'Peluquería', icon: '💇' },
    unas: { accent: '#EC4899', name: 'Uñas', icon: '💅' },
    lash: { accent: '#8B5CF6', name: 'Lash & Cejas', icon: '👁️' },
    spa: { accent: '#14B8A6', name: 'Spa & Estética', icon: '🧖' },
    consultorio: { accent: '#0EA5E9', name: 'Consultorio', icon: '🏥' },
    veterinaria: { accent: '#22C55E', name: 'Veterinaria', icon: '🐾' },
    custom: { accent: '#6366F1', name: 'Negocio', icon: '🏢' },
}

function getTheme(businessType) {
    return RUBRO_THEMES[businessType] || RUBRO_THEMES.custom
}

function baseLayout(content, theme, businessName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GLOWUP</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background:${theme.accent};padding:24px 32px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">
                                            ${businessName}
                                        </span>
                                    </td>
                                    <td align="right">
                                        <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">
                                            GLOWUP
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding:32px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#fafafa;">
                            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;line-height:1.6;">
                                Este email fue enviado por ${businessName} a través de 
                                <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}" style="color:${theme.accent};text-decoration:none;">GLOWUP</a>.<br>
                                Si no solicitaste este turno, podés ignorar este email.
                            </p>
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

    const content = `
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;letter-spacing:-0.02em;">
            Turno confirmado
        </h1>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
            Hola <strong>${clientName}</strong>, tu turno fue agendado exitosamente.
        </p>
        
        <!-- Appointment details card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
                <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-bottom:14px;border-bottom:1px solid #e2e8f0;">
                                <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Servicio</span><br>
                                <span style="font-size:16px;font-weight:600;color:#1e293b;">${serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:14px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Fecha</span><br>
                                            <span style="font-size:15px;font-weight:600;color:#1e293b;">${date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Hora</span><br>
                                            <span style="font-size:15px;font-weight:600;color:#1e293b;">${time}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        ${duration ? `
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Duración</span><br>
                                <span style="font-size:14px;color:#475569;">${duration} minutos</span>
                            </td>
                        </tr>` : ''}
                        ${professional ? `
                        <tr>
                            <td style="padding-top:14px;">
                                <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Profesional</span><br>
                                <span style="font-size:14px;color:#475569;">${professional}</span>
                            </td>
                        </tr>` : ''}
                    </table>
                </td>
            </tr>
        </table>
        
        ${appointmentUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr>
                <td align="center">
                    <a href="${appointmentUrl}" style="display:inline-block;background:${theme.accent};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                        Ver mi turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
        
        ${cancelUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr>
                <td align="center">
                    <a href="${cancelUrl}" style="display:inline-block;color:${theme.accent};text-decoration:none;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:500;border:1px solid #e2e8f0;">
                        Cancelar turno
                    </a>
                </td>
            </tr>
        </table>` : ''}

        ${businessPhone ? `
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
            ¿Necesitás ayuda? Contactanos al <strong style="color:#64748b;">${businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function reminderEmail({ clientName, serviceName, date, time, hoursUntil, businessName, businessType, businessPhone, appointmentUrl }) {
    const theme = getTheme(businessType)

    const content = `
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;letter-spacing:-0.02em;">
            Recordatorio de turno
        </h1>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
            Hola <strong>${clientName}</strong>, te recordamos que tenés un turno 
            ${hoursUntil <= 1 ? '<strong style="color:#f59e0b;">en menos de 1 hora</strong>' : `en <strong>${hoursUntil} horas</strong>`}.
        </p>
        
        <!-- Appointment card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${theme.accent};border-radius:10px;overflow:hidden;">
            <tr>
                <td style="padding:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td>
                                <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;">Servicio</span><br>
                                <span style="font-size:18px;font-weight:700;color:#ffffff;">${serviceName}</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding-top:16px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;">Fecha</span><br>
                                            <span style="font-size:16px;font-weight:700;color:#ffffff;">${date}</span>
                                        </td>
                                        <td width="50%">
                                            <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.05em;">Hora</span><br>
                                            <span style="font-size:16px;font-weight:700;color:#ffffff;">${time}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        ${appointmentUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr>
                <td align="center">
                    <a href="${appointmentUrl}" style="display:inline-block;background:${theme.accent};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                        Ver detalles del turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
        
        ${businessPhone ? `
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
            ¿No podés asistir? Avisanos al <strong style="color:#64748b;">${businessPhone}</strong>
        </p>` : ''}
    `

    return baseLayout(content, theme, businessName)
}

export function welcomeEmail({ clientName, businessName, businessType, webUrl }) {
    const theme = getTheme(businessType)

    const content = `
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;letter-spacing:-0.02em;">
            Bienvenido/a
        </h1>
        <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
            Hola <strong>${clientName}</strong>, fuiste registrado/a como cliente de 
            <strong>${businessName}</strong>. A partir de ahora vas a recibir confirmaciones 
            y recordatorios de tus turnos por email.
        </p>
        
        ${webUrl ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
                <td align="center">
                    <a href="${webUrl}" style="display:inline-block;background:${theme.accent};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                        Reservar un turno
                    </a>
                </td>
            </tr>
        </table>` : ''}
    `

    return baseLayout(content, theme, businessName)
}
