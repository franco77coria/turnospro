// Simple cancel token generation and verification using HMAC
// Uses Web Crypto API (available in Node.js 18+ and all modern browsers)

const getCancelSecret = () => {
    const secret = process.env.CANCEL_TOKEN_SECRET || process.env.CRON_SECRET
    if (!secret && typeof window === 'undefined') {
        throw new Error('CANCEL_TOKEN_SECRET or CRON_SECRET environment variable is required')
    }
    return secret || 'client-fallback-secret'
}

async function hmacSign(data) {
    const encoder = new TextEncoder()
    const secret = getCancelSecret()
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    return Buffer.from(signature).toString('base64url')
}

/**
 * Timing-safe comparison of two strings
 * Prevents timing attacks by always comparing the full length
 */
function timingSafeCompare(a, b) {
    if (a.length !== b.length) return false
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    try {
        const { timingSafeEqual } = require('crypto')
        return timingSafeEqual(bufA, bufB)
    } catch {
        // Fallback for environments without crypto.timingSafeEqual
        let result = 0
        for (let i = 0; i < bufA.length; i++) {
            result |= bufA[i] ^ bufB[i]
        }
        return result === 0
    }
}

/**
 * Generate a cancel token for an appointment
 * Token format: base64url(appointmentId:timestamp:hmac)
 */
export async function generateCancelToken(appointmentId) {
    const timestamp = Date.now().toString()
    const payload = `${appointmentId}:${timestamp}`
    const signature = await hmacSign(payload)
    const token = Buffer.from(`${payload}:${signature}`).toString('base64url')
    return token
}

/**
 * Verify and decode a cancel token
 * Returns { valid: boolean, appointmentId: string | null }
 */
export async function verifyCancelToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64url').toString()
        const parts = decoded.split(':')
        if (parts.length !== 3) return { valid: false, appointmentId: null }

        const [appointmentId, timestamp, providedSig] = parts
        const payload = `${appointmentId}:${timestamp}`
        const expectedSig = await hmacSign(payload)

        // Use timing-safe comparison to prevent timing attacks
        if (!timingSafeCompare(providedSig, expectedSig)) return { valid: false, appointmentId: null }

        // Token valid for 30 days
        const tokenAge = Date.now() - parseInt(timestamp)
        const maxAge = 30 * 24 * 60 * 60 * 1000
        if (tokenAge > maxAge) return { valid: false, appointmentId: null }

        return { valid: true, appointmentId }
    } catch {
        return { valid: false, appointmentId: null }
    }
}
