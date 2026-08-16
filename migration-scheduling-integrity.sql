-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: integridad de agenda y duración de servicios
--
-- Corrige tres problemas de fondo:
--   1. Los servicios vivían en dos lugares (tabla `services` y el JSONB
--      `businesses.services`). El dashboard leía uno y la reserva pública el
--      otro, así que la duración que cargaba el dueño no llegaba a los dos.
--   2. `book_appointment` comparaba `team_member_id = p_team_member_id`. Con
--      NULL eso da NULL, nunca verdadero: los turnos sin profesional asignado
--      JAMÁS detectaban conflicto.
--   3. El índice único de respaldo era sobre la hora exacta, así que un turno
--      de 45 min a las 10:00 no impedía otro a las 10:15.
--
-- Idempotente: se puede correr varias veces.
-- ══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────
-- 1. Los servicios pasan a tener una sola fuente de verdad
-- ──────────────────────────────────────────

-- Vuelca el JSONB heredado a la tabla `services`, solo para los negocios que
-- todavía no tienen ninguno cargado ahí (para no duplicar ni pisar ediciones).
INSERT INTO services (business_id, name, description, duration, price, category, active, sort_order)
SELECT
  b.id,
  trim(item->>'name'),
  nullif(trim(coalesce(item->>'description', '')), ''),
  CASE
    WHEN coalesce(item->>'duration', '') ~ '^[0-9]+$'
      THEN least(480, greatest(1, (item->>'duration')::int))
    ELSE 30
  END,
  CASE
    WHEN coalesce(item->>'price', '') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (item->>'price')::numeric
    ELSE 0
  END,
  nullif(trim(coalesce(item->>'category', '')), ''),
  coalesce(nullif(item->>'active', '')::boolean, true),
  (ord - 1)::int
FROM businesses b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(b.services) = 'array' THEN b.services ELSE '[]'::jsonb END
) WITH ORDINALITY AS t(item, ord)
WHERE NOT EXISTS (SELECT 1 FROM services sv WHERE sv.business_id = b.id)
  AND trim(coalesce(item->>'name', '')) <> '';

-- El JSONB queda como estaba: la app ya no lo lee salvo como último recurso,
-- y conservarlo permite volver atrás sin perder datos.

-- Duraciones inválidas que quedaron de antes.
UPDATE services SET duration = 30 WHERE duration IS NULL OR duration <= 0;
UPDATE appointments SET duration = 30 WHERE duration IS NULL OR duration <= 0;


-- ──────────────────────────────────────────
-- 2. Rango ocupado de cada turno, calculado por la base
-- ──────────────────────────────────────────

-- [minuto_inicio, minuto_fin) — permite comparar superposiciones de verdad
-- en vez de comparar la hora de arranque.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS slot_range int4range
  GENERATED ALWAYS AS (
    int4range(
      (extract(hour from "time")::int * 60 + extract(minute from "time")::int),
      (extract(hour from "time")::int * 60 + extract(minute from "time")::int)
        + coalesce(duration, 30)
    )
  ) STORED;


-- ──────────────────────────────────────────
-- 3. Un profesional no puede estar en dos lugares a la vez
-- ──────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- El índice viejo comparaba la hora exacta: no servía contra superposiciones,
-- y con team_member_id NULL Postgres considera las filas distintas, así que
-- tampoco frenaba los duplicados de un negocio sin equipo cargado.
DROP INDEX IF EXISTS idx_unique_active_appointment;

-- Invariante absoluto: si el turno tiene profesional, no puede pisarse con
-- otro del mismo profesional. Los turnos sin profesional NO entran acá: en un
-- local con 3 personas, tres reservas "cualquiera" a la misma hora son válidas.
-- Ese caso lo resuelve el chequeo de capacidad de book_appointment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap') THEN
    BEGIN
      ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
        EXCLUDE USING gist (
          business_id WITH =,
          team_member_id WITH =,
          "date" WITH =,
          slot_range WITH &&
        ) WHERE (team_member_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'));
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'No se pudo crear appointments_no_overlap: %', sqlerrm;
      RAISE WARNING 'Hay turnos ya superpuestos. Listalos con la consulta del final de este archivo, resolvelos y volvé a correr la migración.';
    END;
  END IF;
END $$;


-- ──────────────────────────────────────────
-- 4. book_appointment: detectar conflictos de verdad
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION book_appointment(
  p_business_id UUID,
  p_client_id UUID,
  p_team_member_id UUID,
  p_service_name TEXT,
  p_date DATE,
  p_time TIME,
  p_duration INTEGER,
  p_price NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_start INTEGER;
  v_end INTEGER;
  v_buffer INTEGER := 0;
  v_capacity INTEGER;
  v_overlaps INTEGER;
  v_probe int4range;
  v_appointment_id UUID;
BEGIN
  IF coalesce(p_duration, 0) <= 0 THEN
    p_duration := 30;
  END IF;

  v_start := extract(hour from p_time)::int * 60 + extract(minute from p_time)::int;
  v_end := v_start + p_duration;

  -- Serializa las reservas del mismo negocio y día. Un FOR UPDATE no alcanza:
  -- si el día está vacío no hay filas que bloquear y dos reservas simultáneas
  -- se cuelan las dos.
  PERFORM pg_advisory_xact_lock(hashtext(p_business_id::text || '|' || p_date::text));

  SELECT CASE
           WHEN coalesce(settings->>'buffer_time', '') ~ '^[0-9]+$'
             THEN (settings->>'buffer_time')::int
           ELSE 0
         END
    INTO v_buffer
    FROM businesses WHERE id = p_business_id;
  v_buffer := coalesce(v_buffer, 0);

  v_probe := int4range(v_start - v_buffer, v_end + v_buffer);

  -- a) El profesional pedido ya tiene algo encima.
  IF p_team_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM appointments
      WHERE business_id = p_business_id
        AND "date" = p_date
        AND team_member_id = p_team_member_id
        AND status NOT IN ('cancelled', 'no_show')
        AND slot_range && v_probe
    ) THEN
      RAISE EXCEPTION 'SLOT_CONFLICT: El profesional ya tiene un turno en ese horario';
    END IF;
  END IF;

  -- b) Capacidad del negocio. Sin equipo cargado se atiende de a uno, así que
  --    cualquier superposición lo llena.
  SELECT greatest(1, count(*)::int) INTO v_capacity
    FROM team_members WHERE business_id = p_business_id AND active = true;

  SELECT count(*)::int INTO v_overlaps
    FROM appointments
   WHERE business_id = p_business_id
     AND "date" = p_date
     AND status NOT IN ('cancelled', 'no_show')
     AND slot_range && v_probe;

  IF v_overlaps >= v_capacity THEN
    RAISE EXCEPTION 'SLOT_CONFLICT: El horario ya esta ocupado';
  END IF;

  INSERT INTO appointments (business_id, client_id, team_member_id, service_name, "date", "time", duration, price, notes, status)
  VALUES (p_business_id, p_client_id, p_team_member_id, p_service_name, p_date, p_time, p_duration, p_price, p_notes, 'pending')
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ──────────────────────────────────────────
-- 5. La página de reserva tiene que poder VER los turnos ocupados
-- ──────────────────────────────────────────
--
-- `appointments` no tiene ninguna política de SELECT para anónimos ni para
-- clientes de otro negocio. Resultado: la página pública de reserva consultaba
-- la agenda del día y RLS le devolvía CERO filas, así que mostraba todos los
-- horarios libres aunque estuvieran ocupados. Esa es la razón de fondo por la
-- que el calendario del dashboard y la reserva pública no se hablaban.
--
-- No se abre la tabla: se publica una vista con lo mínimo para calcular
-- disponibilidad. Sin cliente, sin notas, sin precio.

DROP VIEW IF EXISTS public_busy_slots;

CREATE VIEW public_busy_slots
WITH (security_invoker = off) AS
  SELECT business_id, "date", "time", duration, team_member_id, slot_range
  FROM appointments
  WHERE status NOT IN ('cancelled', 'no_show');

-- Solo lectura. Una vista simple es auto-actualizable para Postgres y, al correr
-- como owner (que saltea RLS), permitiría escribir la tabla a través de ella.
REVOKE ALL ON public_busy_slots FROM anon, authenticated;
GRANT SELECT ON public_busy_slots TO anon, authenticated;


-- ──────────────────────────────────────────
-- 6. Índice de apoyo para las consultas de agenda
-- ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_appointments_business_date_active
  ON appointments (business_id, "date")
  WHERE status NOT IN ('cancelled', 'no_show');


-- ══════════════════════════════════════════════════════════════════════════
-- Diagnóstico: turnos ya superpuestos del mismo profesional.
-- Si el paso 3 tiró un WARNING, corré esto, resolvé y volvé a aplicar.
--
--   SELECT a.id, a.business_id, a."date", a."time", a.duration, a.service_name,
--          b.id AS id_en_conflicto, b."time" AS hora_en_conflicto, b.duration AS duracion_en_conflicto
--     FROM appointments a
--     JOIN appointments b
--       ON a.business_id = b.business_id
--      AND a."date" = b."date"
--      AND a.team_member_id = b.team_member_id
--      AND a.id < b.id
--      AND a.slot_range && b.slot_range
--    WHERE a.team_member_id IS NOT NULL
--      AND a.status NOT IN ('cancelled','no_show')
--      AND b.status NOT IN ('cancelled','no_show')
--    ORDER BY a."date", a."time";
-- ══════════════════════════════════════════════════════════════════════════
