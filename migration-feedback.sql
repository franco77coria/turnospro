-- Feedback de usuarios.
--
-- Sirve para las dos puntas del producto: el cliente que reserva y el dueño
-- que gestiona. Son experiencias muy distintas, así que se guarda el rol con
-- el que estaba usando la app cuando escribió — leer todo junto mezclaría
-- dos productos.

CREATE TABLE IF NOT EXISTS feedback (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_id  UUID REFERENCES businesses(id) ON DELETE SET NULL,

    -- Con qué sombrero puesto lo escribió: 'cliente' | 'negocio'
    rol          TEXT NOT NULL DEFAULT 'cliente',

    -- 1 a 5. Es lo único obligatorio además del texto: pedir más campos baja
    -- muchísimo la cantidad de respuestas.
    puntaje      SMALLINT CHECK (puntaje BETWEEN 1 AND 5),

    -- 'gusta' | 'cambiaria' | 'falla' | 'idea' | 'otro'
    tipo         TEXT NOT NULL DEFAULT 'otro',
    mensaje      TEXT NOT NULL CHECK (length(trim(mensaje)) > 0),

    -- Desde qué pantalla escribió. Un "no se entiende" sin saber dónde
    -- estaba parado no se puede accionar.
    ruta         TEXT,
    -- Navegador/SO, para reproducir fallas. Sin IP ni nada identificatorio.
    user_agent   TEXT,

    -- ¿Nos autoriza a escribirle para repreguntar?
    contactable  BOOLEAN NOT NULL DEFAULT false,

    -- Marcado desde el panel de superadmin al procesarlo.
    atendido     BOOLEAN NOT NULL DEFAULT false,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_creado_idx   ON feedback (creado_en DESC);
CREATE INDEX IF NOT EXISTS feedback_pendiente_idx ON feedback (atendido, creado_en DESC);
CREATE INDEX IF NOT EXISTS feedback_rol_idx       ON feedback (rol, creado_en DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Nadie escribe ni lee directo desde el navegador: todo pasa por
-- /api/feedback, que valida con Zod y aplica rate-limit. Un INSERT abierto
-- acá sería el mismo agujero que tenía `waitlist` (ver
-- migration-cerrar-waitlist-anon.sql): el rate-limit de la ruta no protege
-- nada si se puede escribir directo contra PostgREST.
--
-- RLS activo SIN políticas bloquea a anon y authenticated. Pero el grant
-- amplio de Supabase alcanza a las tablas nuevas, así que hay que sacarlo
-- explícitamente (lección #35).
REVOKE ALL ON feedback FROM anon, authenticated;

-- Y corregir el default, o cada objeto creado después nace abierto otra vez.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Verificación — tiene que dar 0 filas:
--   SELECT * FROM information_schema.table_privileges
--    WHERE table_name = 'feedback' AND grantee IN ('anon','authenticated');
