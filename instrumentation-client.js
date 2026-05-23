// Client-side Sentry — only loaded by next-app when present and DSN is set.
// We use the public DSN so the bundle can ship it safely.

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    // Dynamic import so installations without Sentry don't ship the bundle.
    import('@sentry/nextjs').then((Sentry) => {
        Sentry.init({
            dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT
                || process.env.NEXT_PUBLIC_VERCEL_ENV
                || 'development',
            tracesSampleRate: 0.1,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0.5,
            sendDefaultPii: false,
        })
    }).catch(() => {
        // Sentry SDK missing — fail silently
    })
}
