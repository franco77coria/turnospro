import './globals.css'
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/Toast'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import ThemeApplier, { SCRIPT_TEMA_INICIAL } from '@/components/ThemeApplier'
import JsonLd, { buildWebSiteSchema } from '@/components/JsonLd'
import { Analytics } from '@vercel/analytics/next'
import { appUrl } from '@/lib/app-url'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-bricolage',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FF2E8E',
}

export const metadata = {
  title: {
    default: 'GLOWUP — Brillá hoy',
    template: '%s | GLOWUP',
  },
  description: 'Reservá tu próximo turno en peluquerías, barberías, spas, consultorios y más. Encontrá disponibilidad en tiempo real y reservá sin llamar a nadie.',
  manifest: '/manifest.json',
  metadataBase: new URL(appUrl()),
  openGraph: {
    title: 'GLOWUP — Brillá hoy',
    description: 'Reservá tu próximo turno online. Peluquerías, barberías, spas, consultorios y más.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'GLOWUP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GLOWUP — Brillá hoy',
    description: 'Reservá tu próximo turno online.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large' },
  },
  verification: {
    google: 'KFJ2HWkv8snFFzZAbsLAh9HMsUBtlZamPQBoAfhDFQ4',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${bricolage.variable} ${jakarta.variable}`}>
      <head>
        {/* Corre antes del primer pintado: sin esto, cada carga arranca con el
            color por defecto y salta al del negocio cuando responde la sesión. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        <JsonLd data={buildWebSiteSchema()} />
      </head>
      <body className={jakarta.className}>
        <AuthProvider>
          <ThemeApplier />
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  )
}

