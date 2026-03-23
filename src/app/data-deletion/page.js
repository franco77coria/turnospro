export const metadata = {
  title: 'Eliminación de Datos | GlowUp',
  description: 'Solicitud de eliminación de datos personales - GlowUp',
}

export default function DataDeletionPage() {
  return (
    <main style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem 1.5rem',
      fontFamily: "'Inter', sans-serif",
      color: '#e0e0e0',
      backgroundColor: '#0a0a0a',
      minHeight: '100vh',
      lineHeight: '1.7',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>
        Eliminación de Datos de Usuario
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Última actualización: 23 de marzo de 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>Cómo solicitar la eliminación de tus datos</h2>
        <p>
          En GlowUp respetamos tu derecho a la privacidad. Si deseás eliminar tus datos personales
          de nuestra plataforma, podés hacerlo de las siguientes formas:
        </p>
      </section>

      <section style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #222' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#a78bfa', marginBottom: '0.5rem' }}>Opción 1 — Por email</h3>
        <p>
          Enviá un email a{' '}
          <a href="mailto:franco.coria.r@gmail.com" style={{ color: '#a78bfa' }}>
            franco.coria.r@gmail.com
          </a>
          {' '}con el asunto <strong>&quot;Solicitud de eliminación de datos&quot;</strong> incluyendo:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Tu nombre completo</li>
          <li>Email registrado en la plataforma</li>
          <li>Número de teléfono asociado (si aplica)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#111', borderRadius: '12px', border: '1px solid #222' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#a78bfa', marginBottom: '0.5rem' }}>Opción 2 — Desde tu cuenta</h3>
        <p>
          Si tenés acceso a tu cuenta, podés ir a <strong>Configuración → Cuenta</strong> y 
          solicitar la eliminación desde ahí.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>¿Qué datos se eliminan?</h2>
        <p>Al solicitar la eliminación, se borran:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Tu perfil de usuario y datos personales</li>
          <li>Historial de turnos y reservas</li>
          <li>Datos de contacto (email, teléfono)</li>
          <li>Preferencias y configuraciones</li>
          <li>Historial de mensajes de WhatsApp almacenados</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>Plazo de eliminación</h2>
        <p>
          Procesaremos tu solicitud dentro de los <strong>30 días hábiles</strong> siguientes a la recepción. 
          Recibirás una confirmación por email cuando tus datos hayan sido eliminados.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>Datos que podemos retener</h2>
        <p>
          Algunos datos pueden retenerse por razones legales o contractuales, como:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Registros de transacciones (por obligaciones fiscales)</li>
          <li>Datos anonimizados para estadísticas agregadas</li>
          <li>Información necesaria para cumplir con obligaciones legales</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>Contacto</h2>
        <p>
          Para cualquier consulta sobre la eliminación de datos:{' '}
          <a href="mailto:franco.coria.r@gmail.com" style={{ color: '#a78bfa' }}>
            franco.coria.r@gmail.com
          </a>
        </p>
      </section>
    </main>
  )
}
