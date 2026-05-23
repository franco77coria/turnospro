import crypto from 'crypto'
import { NextResponse } from 'next/server'

/**
 * Timing-safe verification of the cron Bearer secret.
 * Returns null if the request is authorized, or a NextResponse with 401 otherwise.
 */
export function verifyCronAuth(request) {
    const expected = process.env.CRON_SECRET
    if (!expected) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const header = request.headers.get('authorization') || ''
    if (!header.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const provided = header.slice(7)
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!crypto.timingSafeEqual(a, b)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return null
}
