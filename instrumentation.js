// Next.js instrumentation hook — runs once per process before any request.
// Activates Sentry only when SENTRY_DSN is set, so installations without
// Sentry pay no runtime cost beyond the import.
//
// docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
    if (!process.env.SENTRY_DSN) return

    const Sentry = await import('@sentry/nextjs')
    const common = {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || 'development',
        // Conservative sampling — bump up if traffic is low and you want more traces
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        // Don't ship local debug builds to Sentry
        enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLE === '1',
        // Strip request bodies & cookies from event payloads
        sendDefaultPii: false,
        beforeSend(event) {
            // Defense-in-depth: never send Authorization or Cookie headers
            if (event.request?.headers) {
                delete event.request.headers.authorization
                delete event.request.headers.Authorization
                delete event.request.headers.cookie
                delete event.request.headers.Cookie
            }
            return event
        },
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        Sentry.init(common)
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        Sentry.init(common)
    }
}

export async function onRequestError(err, request, context) {
    if (!process.env.SENTRY_DSN) return
    try {
        const Sentry = await import('@sentry/nextjs')
        Sentry.captureRequestError(err, request, context)
    } catch {
        // Swallow — never let Sentry break the request path
    }
}
