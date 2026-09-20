/**
 * Validates and formats phone numbers to E.164 international format.
 * Required for WhatsApp API communication.
 */

export function validateInternationalPhone(phone) {
    if (!phone) return { valid: false, formatted: '', error: 'El teléfono es obligatorio' }

    // Strip spaces, dashes, parens, dots
    const cleaned = phone.replace(/[\s\-().]/g, '')

    // Must start with +
    if (!cleaned.startsWith('+')) {
        return { valid: false, formatted: '', error: 'Debe incluir código de país (ej: +54)' }
    }

    // Extract digits after +
    const digits = cleaned.slice(1)

    // Only digits allowed after +
    if (!/^\d+$/.test(digits)) {
        return { valid: false, formatted: '', error: 'Solo números después del código de país' }
    }

    // E.164: between 8 and 15 digits (including country code)
    if (digits.length < 8 || digits.length > 15) {
        return { valid: false, formatted: '', error: 'Número inválido (8 a 15 dígitos con código de país)' }
    }

    return { valid: true, formatted: `+${digits}`, error: '' }
}

/**
 * Formats a phone number for display with spaces.
 * e.g., +541112345678 → +54 11 1234-5678
 */
export function formatPhoneDisplay(phone) {
    if (!phone) return ''
    const cleaned = phone.replace(/[^\d+]/g, '')

    // +54 9 11 6872-7107
    if (cleaned.startsWith('+54') && cleaned.length >= 13) {
        return `+54 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`
    }

    // La mayoría de los clientes carga el número local, sin código de país:
    // 10 dígitos (11 6872-7107). Antes se mostraba el chorizo sin separar.
    if (!cleaned.startsWith('+') && cleaned.length === 10) {
        return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }

    // 11 dígitos con el 9 de celular delante del área.
    if (!cleaned.startsWith('+') && cleaned.length === 11 && cleaned.startsWith('9')) {
        return `9 ${cleaned.slice(1, 3)} ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    }

    return cleaned
}
