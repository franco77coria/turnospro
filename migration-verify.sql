-- ══════════════════════════════════════════════════════════════════════════
-- Verificación de migration-scheduling-integrity.sql
-- Todo es de SOLO LECTURA. No modifica nada.
-- Cada fila devuelve OK o REVISAR.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Extensión btree_gist (necesaria para la constraint de exclusión)
SELECT '1. btree_gist instalada' AS chequeo,
       CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
            THEN 'OK' ELSE 'REVISAR — falta la extensión' END AS resultado;

-- 2. Columna generada slot_range
SELECT '2. columna slot_range generada' AS chequeo,
       CASE WHEN EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_name = 'appointments' AND column_name = 'slot_range'
                 AND is_generated = 'ALWAYS')
            THEN 'OK' ELSE 'REVISAR — no existe o no es generada' END AS resultado;

-- 3. Constraint de exclusión por superposición  ← la clave
SELECT '3. constraint appointments_no_overlap' AS chequeo,
       coalesce(
         (SELECT 'OK — ' || pg_get_constraintdef(oid)
            FROM pg_constraint WHERE conname = 'appointments_no_overlap'),
         'REVISAR — NO se creó. Mirá el punto 6: probablemente hay turnos ya superpuestos.'
       ) AS resultado;

-- 4. El índice viejo e inútil ya no está
SELECT '4. índice viejo eliminado' AS chequeo,
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_active_appointment')
            THEN 'REVISAR — sigue existiendo' ELSE 'OK' END AS resultado;

-- 5. book_appointment con el chequeo nuevo (lock + capacidad + rango)
SELECT '5. book_appointment actualizada' AS chequeo,
       CASE
         WHEN src IS NULL THEN 'REVISAR — la función no existe'
         WHEN src LIKE '%pg_advisory_xact_lock%'
          AND src LIKE '%slot_range%'
          AND src LIKE '%v_capacity%' THEN 'OK'
         ELSE 'REVISAR — quedó la versión vieja (compara team_member_id con NULL)'
       END AS resultado
  FROM (SELECT (SELECT prosrc FROM pg_proc WHERE proname = 'book_appointment' LIMIT 1) AS src) t;

-- 6. Turnos del mismo profesional que YA se superponen
--    Si el punto 3 dio REVISAR, la causa está acá.
SELECT '6. turnos superpuestos pendientes' AS chequeo,
       CASE WHEN count(*) = 0 THEN 'OK — ninguno'
            ELSE 'REVISAR — ' || count(*) || ' par(es) superpuestos. Detalle abajo.' END AS resultado
  FROM appointments a
  JOIN appointments b
    ON a.business_id = b.business_id
   AND a."date" = b."date"
   AND a.team_member_id = b.team_member_id
   AND a.id < b.id
   AND a.slot_range && b.slot_range
 WHERE a.team_member_id IS NOT NULL
   AND a.status NOT IN ('cancelled','no_show')
   AND b.status NOT IN ('cancelled','no_show');

-- 7. Permisos de la vista pública (tiene que ser SELECT y nada más)
SELECT '7. permisos de public_busy_slots' AS chequeo,
       coalesce(string_agg(DISTINCT grantee || ':' || privilege_type, ', ' ORDER BY grantee || ':' || privilege_type),
                'REVISAR — sin permisos, la reserva no ve nada') AS resultado
  FROM information_schema.table_privileges
 WHERE table_name = 'public_busy_slots' AND grantee IN ('anon','authenticated');


-- ── Detalle de los superpuestos, si el punto 6 dio REVISAR ────────────────
SELECT a."date", a.team_member_id,
       a."time" AS hora_a, a.duration AS dur_a, a.service_name AS servicio_a, a.status AS estado_a,
       b."time" AS hora_b, b.duration AS dur_b, b.service_name AS servicio_b, b.status AS estado_b
  FROM appointments a
  JOIN appointments b
    ON a.business_id = b.business_id
   AND a."date" = b."date"
   AND a.team_member_id = b.team_member_id
   AND a.id < b.id
   AND a.slot_range && b.slot_range
 WHERE a.team_member_id IS NOT NULL
   AND a.status NOT IN ('cancelled','no_show')
   AND b.status NOT IN ('cancelled','no_show')
 ORDER BY a."date", a."time";
