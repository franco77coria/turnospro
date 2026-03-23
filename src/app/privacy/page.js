export const metadata = {
  title: 'Política de Privacidad | GlowUp',
  description: 'Política de privacidad de GlowUp - Plataforma de gestión de turnos',
}

export default function PrivacyPage() {
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
        Política de Privacidad
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Última actualización: 23 de marzo de 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>1. Información que recopilamos</h2>
        <p>En GlowUp recopilamos la siguiente información cuando usás nuestra plataforma:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Nombre y apellido</li>
          <li>Dirección de correo electrónico</li>
          <li>Número de teléfono</li>
          <li>Información de turnos y reservas</li>
          <li>Datos del negocio (para cuentas tipo negocio)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>2. Uso de la información</h2>
        <p>Utilizamos tu información para:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Gestionar y confirmar tus turnos</li>
          <li>Enviar recordatorios por email o WhatsApp</li>
          <li>Mejorar la experiencia de usuario en la plataforma</li>
          <li>Comunicarnos con vos sobre tu cuenta</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>3. WhatsApp Business API</h2>
        <p>
          Utilizamos la API de WhatsApp Business para enviar notificaciones relacionadas con tus turnos 
          (confirmaciones, recordatorios, cancelaciones). Los mensajes son enviados únicamente con tu 
          consentimiento y podés optar por no recibirlos en cualquier momento.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>4. Almacenamiento y seguridad</h2>
        <p>
          Tu información se almacena de forma segura en servidores protegidos con encriptación. 
          Utilizamos Supabase como proveedor de base de datos con políticas de seguridad a nivel de fila (RLS) 
          para garantizar que solo vos y el negocio correspondiente puedan acceder a tus datos.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>5. Compartir información</h2>
        <p>
          No vendemos, alquilamos ni compartimos tu información personal con terceros, excepto:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Con el negocio donde reservaste un turno (nombre, teléfono, email)</li>
          <li>Proveedores de servicio necesarios (email, WhatsApp) bajo acuerdos de confidencialidad</li>
          <li>Cuando sea requerido por ley</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>6. Tus derechos</h2>
        <p>Tenés derecho a:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Acceder a tus datos personales</li>
          <li>Solicitar la corrección de datos inexactos</li>
          <li>Solicitar la eliminación de tus datos</li>
          <li>Retirar tu consentimiento en cualquier momento</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>7. Contacto</h2>
        <p>
          Para cualquier consulta sobre privacidad, podés contactarnos en:{' '}
          <a href="mailto:franco.coria.r@gmail.com" style={{ color: '#a78bfa' }}>
            franco.coria.r@gmail.com
          </a>
        </p>
      </section>
    </main>
  )
}
