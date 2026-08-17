/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()'
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            // Tight CSP. We still need 'unsafe-inline' for Next's inline runtime bootstrap and
            // CSS-in-JS used by some libs. Other inline JS is contained: JsonLd escapes its
            // payload, the few <style dangerouslySetInnerHTML> tags are static strings.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // va.vercel-scripts.com es el script de Vercel Analytics, que se
              // monta en el layout raíz. Sin esta entrada el navegador lo
              // bloqueaba y la analítica nunca registró un solo evento.
              // Si algún día se configura NEXT_PUBLIC_SENTRY_DSN, Sentry va a
              // necesitar su propia entrada en connect-src.
              "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
              "script-src-attr 'none'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://graph.facebook.com",
              "frame-ancestors 'none'",
              // El mapa de la ficha pública es un iframe de Google Maps. Se
              // habilita solo ese origen: cualquier otro iframe sigue bloqueado.
              "frame-src https://www.google.com https://maps.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "manifest-src 'self'",
              "worker-src 'self' blob:",
              "upgrade-insecure-requests",
            ].join('; ')
          },
        ],
      },
    ]
  },
};

export default nextConfig;
