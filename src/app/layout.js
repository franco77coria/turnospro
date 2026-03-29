import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/Toast'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import JsonLd, { buildWebSiteSchema } from '@/components/JsonLd'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
}

export const metadata = {
  title: {
    default: 'GLOWUP — Gestión de turnos para tu negocio',
    template: '%s | GLOWUP',
  },
  description: 'Sistema universal de turnos, equipo y finanzas para peluquerías, barberías, spas, consultorios y más. Reservá tu turno online en segundos.',
  manifest: '/manifest.json',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://glowup.com.ar'),
  openGraph: {
    title: 'GLOWUP — Gestión de turnos para tu negocio',
    description: 'Reservá tu próximo turno online. Peluquerías, barberías, spas, consultorios y más.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'GLOWUP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GLOWUP — Gestión de turnos',
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
    <html lang="es" className={inter.variable}>
      <head>
        <JsonLd data={buildWebSiteSchema()} />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
