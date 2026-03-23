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
    // Simple grouping: +XX XX XXXX-XXXX for Argentine numbers
    if (cleaned.startsWith('+54') && cleaned.length >= 13) {
        return `+54 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 9)}-${cleaned.slice(9)}`
    }
    return cleaned
}
