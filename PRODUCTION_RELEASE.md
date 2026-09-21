# Salida a producción

Esta rama incluye la búsqueda guiada, el nuevo flyer del negocio, correo como
único canal de avisos y correcciones de seguridad y facturación. La compilación
local no modifica el esquema de Supabase: las migraciones deben ejecutarse antes
del despliegue del código.

## Orden de base de datos

1. Comprobar si existen `businesses.plan_id`, `plan_status`,
   `plan_expires_at`, `mp_preapproval_id` y `max_locations`. Si faltan, ejecutar
   `migration-columnas-plan.sql` y revisar la fecha de vencimiento que asigna a
   cada negocio existente.
2. Confirmar que está aplicada `migration-scheduling-integrity.sql` (función
   `book_appointment` y vista `public_busy_slots`). Su archivo de verificación
   es `migration-verify.sql`.
3. Ejecutar `migration-mp-atomic-subscriptions.sql`. Crea la acreditación
   atómica, los campos de cambio de plan y las coordenadas opcionales, y
   bloquea la edición de campos de facturación desde cuentas del navegador.
4. Ejecutar `migration-waitlist-email-only.sql` para permitir que la lista de
   espera guarde email sin teléfono.

Comprobaciones SQL tras las migraciones:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'businesses'
   AND column_name IN ('mp_pending_preapproval_id', 'mp_pending_plan_id',
                       'mp_previous_preapproval_id', 'latitude', 'longitude');

SELECT tgname FROM pg_trigger
 WHERE tgrelid = 'businesses'::regclass
   AND tgname = 'guard_business_billing_columns_trigger';

SELECT proname FROM pg_proc
 WHERE proname = 'apply_mercadopago_payment';

SELECT is_nullable FROM information_schema.columns
 WHERE table_name = 'waitlist' AND column_name = 'client_phone';
```

La prueba de permisos importante es intentar, con JWT de un dueño de prueba,
actualizar `plan_expires_at` por PostgREST y confirmar que falla. Un cambio
normal de `settings` debe seguir funcionando.

## Variables y pruebas externas

Verificar en el entorno de producción `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `CRON_SECRET`,
`MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`. La clave service role
debe existir únicamente en el servidor. Confirmar que el dominio remitente de
Resend está verificado.

En sandbox de Mercado Pago: autorizar una suscripción, confirmar que el
preapproval todavía no activa el plan, aprobar el primer cobro, reenviar ese
webhook y verificar que el vencimiento solo avanza una vez. Enviar también los
avisos `payment` y `subscription_authorized_payment` del mismo cobro: deben
usar el mismo ID de pago y sumar un único período. Cambiar de plan y
confirmar que la suscripción anterior se cancela tras el primer cobro nuevo.
Probar también la cancelación de un cambio pendiente.

Enviar un email de confirmación a una cuenta de prueba y verificar el enlace de
cancelación. Probar el cron con una reserva a menos de dos horas en la zona del
negocio; la marca `reminder_sent` solo debe aparecer después de aceptar el
correo. El canal WhatsApp devuelve 410 y no requiere número.

La búsqueda guiada usa coordenadas solo si el dueño las cargó en Configuración;
por eso conviene completar la ubicación de los negocios reales antes de
promocionar la búsqueda por distancia. El flyer muestra los primeros doce
horarios libres del local para su servicio activo más corto. Las reservas se
revalidan en el servidor al confirmarlas.
