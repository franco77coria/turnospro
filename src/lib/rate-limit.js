import { NextResponse } from 'next/server'

/**
 * In-memory rate limiter.
 *
 * IMPORTANT: This is a single-instance limiter and only works reliably within
 * one warm serverless instance. In production on Vercel with multiple regions
 * or cold starts, attackers can partially evade it. For full protection move
 * to Upstash Redis (vars already documented in .env.example). This helper still
 * provides meaningful per-instance protection and surfaces obvious abuse.
 */
const rateMap = new Map()
const MAX_ENTRIES = 10_000

function cleanupIfNeeded() {
    if (rateMap.size < MAX_ENTRIES) return
    const now = Date.now()
    for (const [key, record] of rateMap) {
        if (now - record.start > record.windowMs * 2) {
            rateMap.delete(key)
        }
    }
    // If still too big, drop the oldest entries
    if (rateMap.size >= MAX_ENTRIES) {
        const toDrop = rateMap.size - Math.floor(MAX_ENTRIES * 0.8)
        const it = rateMap.keys()
        for (let i = 0; i < toDrop; i++) rateMap.delete(it.next().value)
    }
}

export function checkRate(key, limit = 10, windowMs = 60000) {
    const now = Date.now()
    const record = rateMap.get(key) || { count: 0, start: now, windowMs }

    if (now - record.start > windowMs) {
        record.count = 0
        record.start = now
    }

    record.count++
    record.windowMs = windowMs
    rateMap.set(key, record)
    cleanupIfNeeded()

    return {
        success: record.count <= limit,
        remaining: Math.max(0, limit - record.count),
        reset: record.start + windowMs,
    }
}

/**
 * Build a rate-limit key from the request. Combines prefix + IP. Caller can
 * already embed a user id into the prefix (e.g. `booking:${user.id}`) for
 * per-user limits that still degrade gracefully if a user shares an IP.
 */
export function getRateLimitKey(request, prefix = '') {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    return `${prefix}:${ip}`
}

export function applyRateLimit(request, { prefix = 'api', limit = 10, windowMs = 60000 } = {}) {
    const key = getRateLimitKey(request, prefix)
    const result = checkRate(key, limit, windowMs)

    if (!result.success) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': String(limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(result.reset),
                    'Retry-After': String(Math.ceil((result.reset - Date.now()) / 1000)),
                }
            }
        )
    }

    return null
}
