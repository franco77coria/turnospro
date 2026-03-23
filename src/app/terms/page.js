export const metadata = {
  title: 'Condiciones del Servicio | GlowUp',
  description: 'Términos y condiciones de uso de GlowUp - Plataforma de gestión de turnos',
}

export default function TermsPage() {
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
        Condiciones del Servicio
      </h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Última actualización: 23 de marzo de 2026</p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>1. Aceptación de los términos</h2>
        <p>
          Al acceder y utilizar GlowUp, aceptás estos términos y condiciones en su totalidad. 
          Si no estás de acuerdo con alguno de estos términos, no debés usar la plataforma.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>2. Descripción del servicio</h2>
        <p>
          GlowUp es una plataforma de gestión de turnos y reservas que permite a negocios administrar 
          sus agendas y a clientes reservar turnos de forma online. El servicio incluye:
        </p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Reserva de turnos online</li>
          <li>Gestión de agenda para negocios</li>
          <li>Notificaciones por email y WhatsApp</li>
          <li>Panel de administración para negocios</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>3. Cuentas de usuario</h2>
        <p>
          Para usar ciertas funciones de GlowUp, debés crear una cuenta proporcionando información 
          veraz y actualizada. Sos responsable de mantener la confidencialidad de tus credenciales 
          de acceso y de todas las actividades que ocurran bajo tu cuenta.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>4. Uso aceptable</h2>
        <p>Te comprometés a no:</p>
        <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
          <li>Usar la plataforma para fines ilegales</li>
          <li>Reservar turnos de forma fraudulenta o sin intención de asistir</li>
          <li>Intentar acceder a datos de otros usuarios sin autorización</li>
          <li>Interferir con el funcionamiento normal de la plataforma</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>5. Cancelaciones y turnos</h2>
        <p>
          Las políticas de cancelación son establecidas por cada negocio individualmente. 
          Te recomendamos cancelar con la mayor anticipación posible si no podés asistir a un turno. 
          Los no-shows reiterados pueden resultar en restricciones de tu cuenta.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>6. Comunicaciones por WhatsApp</h2>
        <p>
          Al proporcionar tu número de teléfono y reservar un turno, aceptás recibir mensajes 
          transaccionales relacionados con tus reservas (confirmaciones, recordatorios, cancelaciones) 
          a través de WhatsApp. Podés dejar de recibir estos mensajes contactándonos.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>7. Limitación de responsabilidad</h2>
        <p>
          GlowUp actúa como intermediario tecnológico entre negocios y clientes. No somos responsables 
          por la calidad de los servicios prestados por los negocios registrados en la plataforma, 
          ni por disputas entre negocios y clientes.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>8. Modificaciones</h2>
        <p>
          Nos reservamos el derecho de modificar estos términos en cualquier momento. 
          Los cambios serán efectivos al publicarse en esta página. El uso continuado de la 
          plataforma después de los cambios constituye la aceptación de los nuevos términos.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '0.5rem' }}>9. Contacto</h2>
        <p>
          Para consultas sobre estos términos, contactanos en:{' '}
          <a href="mailto:franco.coria.r@gmail.com" style={{ color: '#a78bfa' }}>
            franco.coria.r@gmail.com
          </a>
        </p>
      </section>
    </main>
  )
}
