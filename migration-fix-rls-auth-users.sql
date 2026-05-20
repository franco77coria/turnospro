-- =========================================================================
-- MIGRACIÓN: Corrección de políticas de RLS para evitar error 403 / 42501 (auth.users)
-- =========================================================================
-- En Supabase, las llamadas de API de clientes (anon/authenticated) no tienen
-- permiso de lectura directo sobre la tabla interna auth.users. 
-- Para obtener el email del usuario autenticado de forma segura y eficiente
-- sin causar errores de permisos (403 Forbidden), usamos auth.jwt() ->> 'email'.

-- ── 1. Corregir políticas de la tabla: clients ──

-- Eliminar política anterior si existe
DROP POLICY IF EXISTS "Clients can view own records" ON clients;

-- Crear política corregida
CREATE POLICY "Clients can view own records" ON clients FOR SELECT
USING (email = (auth.jwt() ->> 'email'));


-- ── 2. Corregir políticas de la tabla: appointments ──

-- Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Clients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can update own appointments" ON appointments;

-- Crear políticas corregidas
CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT
USING (client_id IN (
  SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
));

CREATE POLICY "Clients can update own appointments" ON appointments FOR UPDATE
USING (client_id IN (
  SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
));

-- Mensaje de confirmación
-- Las políticas de RLS de clients y appointments han sido optimizadas exitosamente.
