-- Columnas de plan en `businesses`.
--
-- Verificado contra la base de producción: NINGUNA de estas columnas existe.
-- Estaban en migration-subscription-and-fixes.sql (julio) y esa migración
-- nunca se corrió.
--
-- Consecuencia que esto explica: el sistema de suscripción NUNCA funcionó, ni
-- el viejo. El webhook intentaba escribir plan_id/plan_status en columnas
-- inexistentes y PostgREST devolvía 42703 en cada intento. Sumado a que el
-- webhook además daba 503 por falta de secreto, ningún pago activó nunca un
-- plan.
--
-- Sin esto, el código nuevo de suscripciones tampoco anda.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_id           TEXT DEFAULT 'trial';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_status       TEXT DEFAULT 'trialing';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_expires_at   TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_preference_id  TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_locations     INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS businesses_preapproval_idx
    ON businesses (mp_preapproval_id) WHERE mp_preapproval_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- ATENCIÓN: esto decide cuándo se le corta el servicio a los negocios que
-- YA están usando la app.
--
-- El corte es inmediato al vencimiento (sin días de gracia), así que la fecha
-- que se ponga acá es literalmente el día en que dejan de poder trabajar si
-- no se suscribieron antes.
--
-- 30 días es margen para avisarles y que se den de alta sin apuro. Si querés
-- otro plazo, cambiá el número ANTES de correr esto.
-- ─────────────────────────────────────────────────────────────────────────

UPDATE businesses
   SET plan_id         = COALESCE(plan_id, 'trial'),
       plan_status     = COALESCE(plan_status, 'trialing'),
       plan_expires_at = COALESCE(plan_expires_at, NOW() + INTERVAL '30 days'),
       max_locations   = COALESCE(max_locations, 1)
 WHERE plan_expires_at IS NULL;

-- Verificación — mirá la fecha de corte de cada negocio antes de deployar:
--   SELECT name, plan_id, plan_status, plan_expires_at::date AS se_corta_el
--     FROM businesses ORDER BY plan_expires_at;
