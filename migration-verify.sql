-- ══════════════════════════════════════════════════════════════════════════
-- Verificación de migration-scheduling-integrity.sql
--
-- Es UNA sola consulta: el editor de Supabase muestra solo el resultado del
-- último statement, así que todos los chequeos van unidos con UNION ALL.
-- Todo es de SOLO LECTURA. Devuelve 7 filas con OK o REVISAR.
-- ══════════════════════════════════════════════════════════════════════════

WITH chequeos AS (

  -- 1. Extensión necesaria para la constraint de exclusión
  SELECT 1 AS n,
         'btree_gist instalada' AS chequeo,
         CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
              THEN 'OK' ELSE 'REVISAR — falta la extensión' END AS resultado

  UNION ALL
  -- 2. Columna generada con el rango ocupado de cada turno
  SELECT 2,
         'columna slot_range generada',
         CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'appointments'
                   AND column_name = 'slot_range'
                   AND is_generated = 'ALWAYS')
              THEN 'OK' ELSE 'REVISAR — no existe o no es generada' END

  UNION ALL
  -- 3. Constraint de exclusión por superposición  ← la clave
  SELECT 3,
         'constraint appointments_no_overlap',
         coalesce(
           (SELECT 'OK — ' || pg_get_constraintdef(oid)
              FROM pg_constraint WHERE conname = 'appointments_no_overlap'),
           'REVISAR — NO se creó. Mirá la fila 6.')

  UNION ALL
  -- 4. El índice viejo (comparaba la hora exacta) ya no está
  SELECT 4,
         'índice viejo eliminado',
         CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_unique_active_appointment')
              THEN 'REVISAR — sigue existiendo' ELSE 'OK' END

  UNION ALL
  -- 5. book_appointment con lock + capacidad + comparación por rango
  SELECT 5,
         'book_appointment actualizada',
         CASE
           WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'book_appointment' LIMIT 1) IS NULL
             THEN 'REVISAR — la función no existe'
           WHEN (SELECT prosrc FROM pg_proc WHERE proname = 'book_appointment' LIMIT 1) LIKE '%pg_advisory_xact_lock%'
            AND (SELECT prosrc FROM pg_proc WHERE proname = 'book_appointment' LIMIT 1) LIKE '%slot_range%'
            AND (SELECT prosrc FROM pg_proc WHERE proname = 'book_appointment' LIMIT 1) LIKE '%v_capacity%'
             THEN 'OK'
           ELSE 'REVISAR — quedó la versión vieja (compara team_member_id con NULL)'
         END

  UNION ALL
  -- 6. Turnos del mismo profesional que YA se superponen.
  --    Si la fila 3 dio REVISAR, la causa está acá.
  SELECT 6,
         'turnos superpuestos pendientes',
         CASE WHEN (SELECT count(*) FROM appointments a
                      JOIN appointments b
                        ON a.business_id = b.business_id
                       AND a."date" = b."date"
                       AND a.team_member_id = b.team_member_id
                       AND a.id < b.id
                       AND a.slot_range && b.slot_range
                     WHERE a.team_member_id IS NOT NULL
                       AND a.status NOT IN ('cancelled','no_show')
                       AND b.status NOT IN ('cancelled','no_show')) = 0
              THEN 'OK — ninguno'
              ELSE 'REVISAR — ' || (SELECT count(*)::text FROM appointments a
                      JOIN appointments b
                        ON a.business_id = b.business_id
                       AND a."date" = b."date"
                       AND a.team_member_id = b.team_member_id
                       AND a.id < b.id
                       AND a.slot_range && b.slot_range
                     WHERE a.team_member_id IS NOT NULL
                       AND a.status NOT IN ('cancelled','no_show')
                       AND b.status NOT IN ('cancelled','no_show')) || ' par(es). Corré la consulta del final.'
         END

  UNION ALL
  -- 7. Permisos de la vista pública: tiene que ser SELECT y nada más
  SELECT 7,
         'permisos de public_busy_slots',
         coalesce((SELECT string_agg(DISTINCT grantee || ':' || privilege_type, ', ')
                     FROM information_schema.table_privileges
                    WHERE table_name = 'public_busy_slots'
                      AND grantee IN ('anon','authenticated')),
                  'REVISAR — sin permisos, la reserva no ve nada')
)
SELECT n, chequeo, resultado FROM chequeos ORDER BY n;


-- ══════════════════════════════════════════════════════════════════════════
-- Solo si la fila 6 dio REVISAR: seleccioná estas líneas y ejecutalas aparte
-- para ver qué turnos se pisan.
-- ══════════════════════════════════════════════════════════════════════════
--
-- SELECT a."date", a.team_member_id,
--        a."time" AS hora_a, a.duration AS dur_a, a.service_name AS servicio_a, a.status AS estado_a,
--        b."time" AS hora_b, b.duration AS dur_b, b.service_name AS servicio_b, b.status AS estado_b
--   FROM appointments a
--   JOIN appointments b
--     ON a.business_id = b.business_id
--    AND a."date" = b."date"
--    AND a.team_member_id = b.team_member_id
--    AND a.id < b.id
--    AND a.slot_range && b.slot_range
--  WHERE a.team_member_id IS NOT NULL
--    AND a.status NOT IN ('cancelled','no_show')
--    AND b.status NOT IN ('cancelled','no_show')
--  ORDER BY a."date", a."time";
