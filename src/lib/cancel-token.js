// HMAC-signed cancel tokens with one-time-use tracking via cancel_tokens table.
//
// Token format: base64url(appointmentId:timestamp:hmac)
// HMAC = HMAC_SHA256(CANCEL_TOKEN_SECRET, appointmentId + ":" + timestamp)
//
// On verification we:
//   1. Verify the HMAC with a constant-time comparison.
//   2. Check the timestamp is within the validity window (30 days).
//   3. Check the token was not already consumed in cancel_tokens.
//
// markCancelTokenUsed() is called by the cancel endpoint AFTER it has fetched
// the appointment but BEFORE it performs the cancel. The unique constraint on
// token_hash gives us the atomic guard against double-use.

import crypto from 'crypto'

const getCancelSecret = () => {
    const secret = process.env.CANCEL_TOKEN_SECRET || process.env.CRON_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    return secret || 'glowup-cancel-secret-2026'
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

function timingSafeCompare(a, b) {
    if (a.length !== b.length) return false
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    try {
        return crypto.timingSafeEqual(bufA, bufB)
    } catch {
        let result = 0
        for (let i = 0; i < bufA.length; i++) {
            result |= bufA[i] ^ bufB[i]
        }
        return result === 0
    }
}

/**
 * Generate a cancel token for an appointment.
 * Token is valid for 30 days from generation.
 */
export async function generateCancelToken(appointmentId) {
    const timestamp = Date.now().toString()
    const payload = `${appointmentId}:${timestamp}`
    const signature = await hmacSign(payload)
    const token = Buffer.from(`${payload}:${signature}`).toString('base64url')
    return token
}

/**
 * Hash a token for storage. We keep only the hash so that a DB leak doesn't
 * expose live cancel tokens.
 */
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Verify a cancel token's signature and age (without checking DB consumption).
 * Returns { valid, appointmentId, expiresAt }.
 */
export async function verifyCancelToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64url').toString()
        const parts = decoded.split(':')
        if (parts.length !== 3) return { valid: false, appointmentId: null }

        const [appointmentId, timestamp, providedSig] = parts
        const payload = `${appointmentId}:${timestamp}`
        const expectedSig = await hmacSign(payload)

        if (!timingSafeCompare(providedSig, expectedSig)) return { valid: false, appointmentId: null }

        const tokenAge = Date.now() - parseInt(timestamp)
        const maxAge = 30 * 24 * 60 * 60 * 1000
        if (tokenAge > maxAge) return { valid: false, appointmentId: null }

        const expiresAt = new Date(parseInt(timestamp) + maxAge)
        return { valid: true, appointmentId, expiresAt }
    } catch {
        return { valid: false, appointmentId: null }
    }
}

/**
 * Atomically claim a cancel token. Returns true if this caller won the race,
 * false if the token was already consumed.
 *
 * The unique constraint on token_hash makes the INSERT itself the lock — if
 * a row with this hash already exists, postgres rejects with 23505 and we
 * know someone else used it first.
 */
export async function markCancelTokenUsed(supabase, token, appointmentId, expiresAt) {
    const tokenHash = hashToken(token)
    const { error } = await supabase
        .from('cancel_tokens')
        .insert([{
            appointment_id: appointmentId,
            token_hash: tokenHash,
            used: true,
            used_at: new Date().toISOString(),
            expires_at: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
        }])

    if (!error) return { ok: true }

    // 23505 = unique_violation → token already consumed
    if (error.code === '23505') return { ok: false, reason: 'already_used' }

    // Any other error: surface but treat as "claim failed" so we don't double-cancel.
    console.error('markCancelTokenUsed unexpected error:', error)
    return { ok: false, reason: 'db_error' }
}
