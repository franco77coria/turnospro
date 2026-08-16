-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: pasar a "automático" el intervalo entre horarios
--
-- El onboarding escribía `slot_duration: 30` hardcodeado en los settings de
-- todo negocio nuevo, y ese ajuste nunca estuvo en la interfaz: nadie lo
-- eligió. Con un servicio de 45 min, eso ofrece 10:00, 10:30, 11:00… y deja
-- 15 minutos muertos después de cada turno.
--
-- Se borra la clave solo donde vale exactamente 30 (el valor que escribía el
-- onboarding). Cualquier otro valor sí fue una decisión del dueño desde la
-- pantalla de Ajustes, y se respeta.
--
-- Sin la clave, el paso lo define la duración del servicio: un corte de 45
-- min se ofrece 10:00, 10:45, 11:30…
--
-- Idempotente: correrla dos veces no cambia nada la segunda vez.
-- Reversible: para volver atrás en un negocio puntual, alcanza con elegir
-- "Cada 30 minutos" en Ajustes.
-- ══════════════════════════════════════════════════════════════════════════

UPDATE businesses
   SET settings = settings - 'slot_duration'
 WHERE settings->>'slot_duration' = '30';


-- ── Estado final de todos los negocios ────────────────────────────────────
-- El editor de Supabase muestra solo el resultado del último statement,
-- así que este SELECT es el que vas a ver.
--
-- `buffer_time` NO se toca: es una decisión real del dueño. Pero se marca
-- cuando es sospechosamente alto, porque es fácil cargar ahí la duración del
-- servicio por error — y el buffer se aplica a AMBOS lados del turno, así que
-- 45 min de buffer sobre un turno de 45 min bloquean 2 h 15 de agenda.

SELECT
  b.name AS negocio,
  coalesce(b.settings->>'slot_duration', 'automático') AS intervalo,
  coalesce(b.settings->>'buffer_time', '0') || ' min' AS buffer,
  (SELECT string_agg(s.duration::text, ' / ' ORDER BY s.duration)
     FROM services s
    WHERE s.business_id = b.id AND s.active) AS duraciones_de_servicios,
  CASE
    WHEN coalesce((b.settings->>'buffer_time')::int, 0) >= 30
      THEN 'REVISAR buffer — bloquea ' ||
           (coalesce((b.settings->>'buffer_time')::int, 0) * 2)::text ||
           ' min extra por turno'
    ELSE 'ok'
  END AS aviso
FROM businesses b
ORDER BY b.name;
