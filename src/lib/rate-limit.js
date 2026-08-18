import { NextResponse } from 'next/server'

/**
 * Rate limiter with two backends:
 *   - Upstash Redis (cross-instance, production-grade) when
 *     UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 *   - In-memory Map (per-instance, best-effort) otherwise.
 *
 * The Upstash backend is preferred in serverless because each function
 * invocation can land on a different instance — an in-memory Map only
 * protects against an attacker hitting the same warm container repeatedly.
 *
 * Auto-detected at module load. To force the in-memory backend (tests),
 * leave the Upstash env vars unset.
 */

// ─── In-memory backend ─────────────────────────────────────────────
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

// ─── Upstash backend ────────────────────────────────────────────────
// Lazy-loaded so apps without Upstash don't pay the import cost.
let upstashRedis = null
let upstashEnabled = null // null = not yet decided, true/false = decided

function getUpstash() {
    if (upstashEnabled === false) return null
    if (upstashRedis) return upstashRedis

    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
        upstashEnabled = false
        return null
    }

    try {
        const { Redis } = require('@upstash/redis')
        upstashRedis = new Redis({ url, token })
        upstashEnabled = true
        return upstashRedis
    } catch (err) {
        console.warn('Upstash Redis client failed to initialize, falling back to in-memory:', err?.message)
        upstashEnabled = false
        return null
    }
}

/**
 * Sliding-window count via Upstash. Implementation uses INCR + EXPIRE which
 * is closer to a fixed-window counter — good enough for abuse mitigation,
 * and dramatically cheaper than an actual sliding-log algorithm.
 */
async function checkRateUpstash(redis, key, limit, windowMs) {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
    const bucket = Math.floor(Date.now() / windowMs)
    const fullKey = `rl:${key}:${bucket}`

    try {
        const count = await redis.incr(fullKey)
        if (count === 1) {
            // First hit in this bucket — set TTL so the key disappears
            await redis.expire(fullKey, windowSec)
        }
        const reset = (bucket + 1) * windowMs
        return {
            success: count <= limit,
            remaining: Math.max(0, limit - count),
            reset,
        }
    } catch (err) {
        // Network/Redis failure: fail open with a warning so we don't break the app.
        // The in-memory fallback below still applies because the caller will
        // never reach this path (we only call upstash when configured).
        console.warn('Upstash rate-limit check failed, allowing request:', err?.message)
        return { success: true, remaining: limit, reset: Date.now() + windowMs }
    }
}

// ─── Public API ─────────────────────────────────────────────────────

export function getRateLimitKey(request, prefix = '') {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    return `${prefix}:${ip}`
}

/**
 * Apply rate limiting. Returns a 429 NextResponse if the limit is exceeded,
 * or null if the request can proceed.
 *
 * Always await this call — it is async to support the Upstash backend even
 * though the in-memory branch is synchronous.
 */
export async function applyRateLimit(request, { prefix = 'api', limit = 10, windowMs = 60000 } = {}) {
    const key = getRateLimitKey(request, prefix)
    const redis = getUpstash()

    const result = redis
        ? await checkRateUpstash(redis, key, limit, windowMs)
        : checkRate(key, limit, windowMs)

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
                },
            }
        )
    }

    return null
}

/**
 * Test-only helper: reset the in-memory bucket. Doesn't touch Upstash.
 */
export function _resetForTests() {
    rateMap.clear()
}
