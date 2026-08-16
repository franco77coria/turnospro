-- ══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: galería de fotos del negocio
--
-- Hasta ahora cada negocio podía tener una sola imagen (`cover_image_url`,
-- guardada como `{businessId}/cover.{ext}` en el bucket business-images).
-- La ficha pública necesita varias.
--
-- Idempotente.
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  -- Ruta dentro del bucket. Sin esto no se puede borrar el archivo al
  -- eliminar la fila y el storage se llena de huérfanos.
  storage_path TEXT,
  alt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_photos_business
  ON business_photos (business_id, sort_order, created_at);

ALTER TABLE business_photos ENABLE ROW LEVEL SECURITY;

-- Lectura pública: la ficha del negocio es una página abierta.
DROP POLICY IF EXISTS "public_read_business_photos" ON business_photos;
CREATE POLICY "public_read_business_photos" ON business_photos
  FOR SELECT USING (true);

-- Escritura solo del dueño del negocio.
DROP POLICY IF EXISTS "owner_manages_business_photos" ON business_photos;
CREATE POLICY "owner_manages_business_photos" ON business_photos
  FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));


-- ── Verificación ──────────────────────────────────────────────────────────
SELECT
  'business_photos' AS tabla,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_photos')
       THEN 'OK — creada' ELSE 'REVISAR — no existe' END AS estado,
  (SELECT count(*)::text FROM pg_policies WHERE tablename = 'business_photos') || ' política(s)' AS rls;
