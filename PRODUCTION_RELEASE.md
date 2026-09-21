# Salida a producción

Esta rama incluye la búsqueda guiada, el nuevo flyer del negocio, correo como
único canal de avisos y correcciones de seguridad y facturación. La compilación
local no modifica el esquema de Supabase: las migraciones deben ejecutarse antes
del despliegue del código.

## Estado verificado el 21/09/2026

Las seis migraciones de abajo ya se aplicaron al proyecto Supabase vinculado
`ubbaybpyuenhhzwpysdb`. `migration-verify.sql` pasó todos sus controles.
También se probó con un usuario autenticado que no puede cambiar campos de
facturación, mientras que sí puede guardar ajustes normales. La función de
reserva quedó ejecutable solo por `service_role`. Una reserva de prueba y dos
reservas con profesional de licencia se ensayaron dentro de transacciones
revertidas.

La rama pasa 239 pruebas, ESLint sin errores y `next build`. La búsqueda guiada
respondió con servicios y turnos reales desde la base. Resend aceptó un mensaje
de prueba usando la clave configurada en Vercel para producción. El token de
Mercado Pago configurado en Vercel respondió correctamente a `/users/me`.

**Pendiente antes de declarar listo el cobro real:** completar el flujo de
suscripción y primer pago con comprador y tarjeta de prueba, verificar el
webhook firmado y los reintentos, el cambio de plan y su cancelación. La
existencia del token y las pruebas unitarias no comprueban ese recorrido. Aún
no se desplegó esta rama.
El ensayo de alta pendiente con la credencial TEST no creó ninguna suscripción:
Mercado Pago rechazó `test_payer@example.com` por pertenecer a otro país y
rechazó un email inferido del ID de un usuario de prueba con `User bad request`.
Para repetirlo hace falta el email exacto del comprador de prueba que figura
en el panel de Mercado Pago.

El asesor de seguridad de Supabase todavía informa advertencias conocidas:
`public_busy_slots` se ejecuta con permisos de la vista para exponer únicamente
ocupación sin datos de clientes; `accept_invite` requiere sesión y un token de
invitación de un solo uso; `btree_gist` y `pg_trgm` están en `public`, cuyo
permiso `CREATE` está cerrado a los roles web. Sigue pendiente activar en Auth
la protección contra contraseñas filtradas.

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
5. Ejecutar `migration-function-permissions.sql` para cerrar funciones internas
   heredadas y dejar la aceptación de invitaciones solo a usuarios autenticados.
6. Ejecutar `migration-close-public-schema.sql` para habilitar RLS en tablas
   heredadas, quitar la vista de equipo obsoleta y fijar los `search_path`.

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

También comprobar que `anon` y `authenticated` no pueden ejecutar
`book_appointment`; las reservas públicas deben entrar exclusivamente por
`POST /api/appointments`, que valida servicio, precio, jornada y plan.

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
