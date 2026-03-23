// Simple in-memory rate limiter
// For production with multiple instances, use Redis-based solution (e.g., @upstash/ratelimit)

const rateMap = new Map()

// Clean up old entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateMap) {
        if (now - record.start > record.windowMs * 2) {
            rateMap.delete(key)
        }
    }
}, 5 * 60 * 1000)

/**
 * Check if a request is within rate limits
 * @param {string} key - Unique identifier (e.g., IP, user ID)
 * @param {number} limit - Max requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds (default: 60s)
 * @returns {{ success: boolean, remaining: number, reset: number }}
 */
export function checkRate(key, limit = 10, windowMs = 60000) {
    const now = Date.now()
    const record = rateMap.get(key) || { count: 0, start: now, windowMs }

    // Reset window if expired
    if (now - record.start > windowMs) {
        record.count = 0
        record.start = now
    }

    record.count++
    record.windowMs = windowMs
    rateMap.set(key, record)

    return {
        success: record.count <= limit,
        remaining: Math.max(0, limit - record.count),
        reset: record.start + windowMs,
    }
}

/**
 * Get rate limit key from request
 * Uses X-Forwarded-For header (Vercel sets this) or falls back to a default
 */
export function getRateLimitKey(request, prefix = '') {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
    return `${prefix}:${ip}`
}

/**
 * Apply rate limiting to a request and return error response if exceeded
 * @returns {Response|null} - Returns error response if rate limited, null if OK
 */
export function applyRateLimit(request, { prefix = 'api', limit = 10, windowMs = 60000 } = {}) {
    const { NextResponse } = require('next/server')
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

    return null // Not rate limited
}
