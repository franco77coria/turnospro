-- Cerrar el INSERT anónimo directo sobre `waitlist`.
--
-- Verificado contra la base en vivo: un POST a /rest/v1/waitlist con la anon
-- key devolvía 23503 (violación de FK), no 42501. Es decir, RLS DEJABA pasar
-- la escritura y lo único que la frenó fue que el business_id no existía. Con
-- un business_id real (que es público: la tabla `businesses` se lee sin
-- sesión) cualquiera puede inflar la lista de espera de cualquier negocio con
-- teléfonos inventados, desde afuera de la app.
--
-- El rate-limit por IP de /api/waitlist no protege nada acá, porque este
-- camino ni siquiera pasa por la app: va directo a PostgREST.
--
-- La ruta /api/waitlist usa service_role (createSupabaseAdmin), así que
-- sacarle el permiso a anon/authenticated no rompe el alta legítima: la
-- sigue haciendo el servidor, después de validar con Zod y de aplicar el
-- rate-limit.

-- 1. La política permisiva que lo habilitaba.
DROP POLICY IF EXISTS "waitlist_insert" ON waitlist;

-- 2. RLS sola no alcanza: Supabase concede privilegios a NIVEL TABLA
--    (GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated), y ese
--    grant sigue vigente aunque no quede ninguna política.
REVOKE INSERT, UPDATE, DELETE ON waitlist FROM anon, authenticated;

-- 3. La lectura también estaba abierta con USING (true), y la tabla guarda
--    client_phone y client_email: es la lista de contactos de los clientes
--    que se quedaron sin turno.
DROP POLICY IF EXISTS "waitlist_select" ON waitlist;

CREATE POLICY "waitlist_select_negocio" ON waitlist
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
        OR business_id IN (
            SELECT business_id FROM team_members
             WHERE user_id = auth.uid() AND active = true
        )
    );

-- Verificación — la primera tiene que dar 0 filas:
--   SELECT * FROM information_schema.table_privileges
--    WHERE table_name = 'waitlist'
--      AND grantee IN ('anon','authenticated')
--      AND privilege_type IN ('INSERT','UPDATE','DELETE');
--
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'waitlist';
