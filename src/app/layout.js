import './globals.css'
import { AuthProvider } from '@/context/AuthContext'

export const metadata = {
  title: 'GLOWUP — Gestión de turnos para tu negocio',
  description: 'Sistema universal de turnos, equipo y finanzas para peluquerías, barberías, spas, consultorios y más.',
  manifest: '/manifest.json',
  themeColor: '#4F46E5',
  verification: {
    google: 'KFJ2HWkv8snFFzZAbsLAh9HMsUBtlZamPQBoAfhDFQ4',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
