-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: crear el bucket de imágenes del negocio
--
-- `/api/businesses/upload` escribe en el bucket `business-images` desde
-- siempre, pero ninguna pantalla llamaba a esa ruta, así que el bucket nunca
-- se creó. Sin esto, la primera subida falla con "Bucket not found".
--
-- Público a propósito: las imágenes se muestran en la ficha abierta del
-- negocio y se sirven por URL directa.
--
-- La escritura NO se abre acá: la ruta de subida usa la service role key,
-- que saltea RLS. Nadie más puede escribir en el bucket.
--
-- Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-images',
  'business-images',
  true,
  5242880,  -- 5 MB, el mismo tope que valida la ruta
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- ── Verificación ──────────────────────────────────────────────────────────
SELECT
  id AS bucket,
  CASE WHEN public THEN 'OK — público' ELSE 'REVISAR — privado, las fotos no se verían' END AS visibilidad,
  (file_size_limit / 1024 / 1024)::text || ' MB' AS tope,
  array_to_string(allowed_mime_types, ', ') AS formatos
FROM storage.buckets
WHERE id = 'business-images';
