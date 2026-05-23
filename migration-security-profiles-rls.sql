-- =========================================================================
-- MIGRACIÓN DE SEGURIDAD — bloquear escalada de privilegios vía profiles
-- =========================================================================
-- La política original permitía a un usuario actualizar cualquier columna
-- de su propio row, incluyendo `role`, `business_id` y `approved`.
-- Eso permitía a un cliente convertirse en `superadmin` con un solo UPDATE
-- desde la consola del navegador, bypaseando el middleware.
--
-- Esta migración:
--   1. Reemplaza la policy de UPDATE de profiles con una versión que NO
--      permite cambiar role/business_id/account_type/approved desde RLS.
--      Solo el service role (server-side) puede modificar esos campos.
--   2. Garantiza que email/id no se puedan reescribir.
--   3. Endurece la política de INSERT para que el role inicial venga
--      restringido (sólo 'user' o 'pending_business').
-- =========================================================================

-- 1. Reemplazar política de UPDATE
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile fields" ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id
    -- Campos críticos: no permitir que el usuario los modifique a sí mismo
    AND role            IS NOT DISTINCT FROM (SELECT p.role            FROM profiles p WHERE p.id = auth.uid())
    AND business_id     IS NOT DISTINCT FROM (SELECT p.business_id     FROM profiles p WHERE p.id = auth.uid())
    AND COALESCE(account_type, '') = COALESCE((SELECT p.account_type   FROM profiles p WHERE p.id = auth.uid()), '')
    AND COALESCE(approved, true) = COALESCE((SELECT p.approved         FROM profiles p WHERE p.id = auth.uid()), true)
    AND email           IS NOT DISTINCT FROM (SELECT p.email           FROM profiles p WHERE p.id = auth.uid())
);

-- 2. Endurecer INSERT — solo roles 'user' o 'pending_business' permitidos desde anon/auth
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT
WITH CHECK (
    auth.uid() = id
    AND (role IS NULL OR role IN ('user', 'pending_business'))
    AND (account_type IS NULL OR account_type IN ('user', 'business'))
    AND (approved IS NULL OR approved = false)
);

-- 3. (Opcional pero recomendado) Trigger de auditoría para detectar intentos
--    de escalada (si alguien intenta cambiar role a 'superadmin').
CREATE OR REPLACE FUNCTION log_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE NOTICE 'profiles.role changed for id=%: % -> % (by auth.uid()=%)',
            NEW.id, OLD.role, NEW.role, auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_profile_role_change ON profiles;
CREATE TRIGGER trg_log_profile_role_change
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION log_profile_role_change();

-- =========================================================================
-- VERIFICACIÓN
-- =========================================================================
-- Después de aplicar, probar desde la consola del navegador (con sesión activa):
--   await supabase.from('profiles').update({ role: 'superadmin' }).eq('id', userId)
-- Debe devolver:
--   "new row violates row-level security policy" (error 42501)
-- =========================================================================
