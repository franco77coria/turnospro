import Link from 'next/link'

export const metadata = {
    title: 'Sin conexión | GLOWUP',
    description: 'No hay conexión a internet disponible.',
}

export default function OfflinePage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: '#FAFAFA',
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#EEF2FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.5rem', fontSize: '2rem',
            }}>
                📡
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
                Sin conexión
            </h1>
            <p style={{ color: '#6B7280', maxWidth: 400, marginBottom: '2rem', lineHeight: 1.6 }}>
                Parece que no tenés conexión a internet. Verificá tu conexión e intentá de nuevo.
            </p>
            <Link
                href="/"
                style={{
                    display: 'inline-block', padding: '0.75rem 1.5rem',
                    background: '#4F46E5', color: 'white', borderRadius: 8,
                    textDecoration: 'none', fontWeight: 600,
                }}
            >
                Volver al inicio
            </Link>
        </div>
    )
}
