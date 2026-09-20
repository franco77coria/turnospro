-- Color de marca configurable.
--
-- Dos lugares, porque son dos decisiones distintas:
--   * El DUEÑO elige el color de su negocio. Se aplica en su panel y también
--     en su ficha pública de reserva, que es la cara del negocio.
--   * El CLIENTE elige cómo quiere ver SU app. Es una preferencia personal
--     y no tiene por qué pisar la identidad de ningún negocio.
--
-- El color del negocio ya tiene dónde vivir: businesses.settings es JSONB y
-- no necesita migración. Los perfiles no tenían dónde guardar preferencias.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.preferences IS
    'Preferencias de interfaz del usuario. Hoy: { "theme": {...} } con el color elegido.';

-- El perfil ya tenía políticas de "cada uno ve y edita el suyo", así que la
-- columna nueva queda cubierta sin tocar RLS.
--
-- OJO (lección #58): si en algún momento se hace
--   revoke update on profiles ... + grant update (col1, col2) ...
-- esta columna queda SIN permiso y el guardado va a devolver 204 sin escribir.
-- Verificar entonces con information_schema.column_privileges.

-- Verificación:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'preferences';
