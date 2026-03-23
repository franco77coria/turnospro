-- ============================================================
-- GLOWUP — Migrate services from JSONB to services table
-- Run this AFTER migration-phase2-4.sql has created the services table
-- This is safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- ============================================================

-- Migrate existing JSONB services to the services table
INSERT INTO services (business_id, name, duration, price, sort_order)
SELECT
  b.id as business_id,
  (svc->>'name')::text as name,
  COALESCE((svc->>'duration')::integer, 30) as duration,
  COALESCE((svc->>'price')::numeric, 0) as price,
  (row_number() OVER (PARTITION BY b.id ORDER BY ordinality))::integer - 1 as sort_order
FROM businesses b,
  jsonb_array_elements(b.services) WITH ORDINALITY AS t(svc, ordinality)
WHERE b.services IS NOT NULL
  AND jsonb_typeof(b.services) = 'array'
  AND jsonb_array_length(b.services) > 0
ON CONFLICT DO NOTHING;

-- Verify migration count
SELECT
  'Total businesses with JSONB services' as metric,
  COUNT(DISTINCT id) as count
FROM businesses
WHERE services IS NOT NULL
  AND jsonb_typeof(services) = 'array'
  AND jsonb_array_length(services) > 0

UNION ALL

SELECT
  'Total services migrated to table' as metric,
  COUNT(*) as count
FROM services;
