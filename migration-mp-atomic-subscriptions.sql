-- Ejecutar antes de desplegar el webhook y el endpoint de suscripciones nuevos.
-- La confirmación del cobro y su clave de idempotencia comparten transacción.
CREATE TABLE IF NOT EXISTS mp_pagos_aplicados (
    payment_id TEXT PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id TEXT,
    aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE mp_pagos_aplicados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON mp_pagos_aplicados FROM anon, authenticated;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_pending_preapproval_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_pending_plan_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_previous_preapproval_id TEXT;
-- La búsqueda por cercanía y el formulario de configuración usan estas columnas.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_mp_pending_preapproval_idx
    ON businesses (mp_pending_preapproval_id) WHERE mp_pending_preapproval_id IS NOT NULL;

-- RLS limita la fila, no las columnas. Sin este trigger el dueño puede hacer
-- PATCH a plan_expires_at/max_locations desde la anon key y regalarse un plan.
CREATE OR REPLACE FUNCTION public.guard_business_billing_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.plan_id := 'trial';
        NEW.plan_status := 'trialing';
        NEW.plan_expires_at := now() + interval '7 days';
        NEW.max_locations := 1;
        NEW.mp_preapproval_id := NULL;
        NEW.mp_preference_id := NULL;
        NEW.mp_pending_preapproval_id := NULL;
        NEW.mp_pending_plan_id := NULL;
        NEW.mp_previous_preapproval_id := NULL;
    ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
       OR NEW.plan_status IS DISTINCT FROM OLD.plan_status
       OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at
       OR NEW.max_locations IS DISTINCT FROM OLD.max_locations
       OR NEW.mp_preapproval_id IS DISTINCT FROM OLD.mp_preapproval_id
       OR NEW.mp_preference_id IS DISTINCT FROM OLD.mp_preference_id
       OR NEW.mp_pending_preapproval_id IS DISTINCT FROM OLD.mp_pending_preapproval_id
       OR NEW.mp_pending_plan_id IS DISTINCT FROM OLD.mp_pending_plan_id
       OR NEW.mp_previous_preapproval_id IS DISTINCT FROM OLD.mp_previous_preapproval_id THEN
        RAISE EXCEPTION 'No se pueden modificar campos de facturación desde el navegador';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_business_billing_columns_trigger ON businesses;
CREATE TRIGGER guard_business_billing_columns_trigger
    BEFORE INSERT OR UPDATE ON businesses FOR EACH ROW
    EXECUTE FUNCTION public.guard_business_billing_columns();

CREATE OR REPLACE FUNCTION public.apply_mercadopago_payment(
    p_payment_id TEXT,
    p_business_id UUID,
    p_plan_id TEXT,
    p_max_locations INTEGER,
    p_preapproval_id TEXT DEFAULT NULL
)
RETURNS TABLE(applied BOOLEAN, previous_preapproval_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_business businesses%ROWTYPE;
    old_id TEXT;
    base_date TIMESTAMPTZ;
BEGIN
    IF p_payment_id IS NULL OR length(btrim(p_payment_id)) = 0 OR length(p_payment_id) > 160
       OR p_business_id IS NULL OR p_plan_id IS NULL
       OR p_plan_id NOT IN ('pro', 'multi', 'base')
       OR p_max_locations IS NULL OR p_max_locations < 1 OR p_max_locations > 100 THEN
        RAISE EXCEPTION 'Pago o plan inválido';
    END IF;

    SELECT * INTO current_business FROM businesses
        WHERE id = p_business_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Negocio no encontrado'; END IF;

    -- Nunca aplicar un cobro de otra suscripción al negocio indicado en la
    -- referencia externa. Una notificación vieja del plan anterior se ignora.
    IF p_preapproval_id IS NOT NULL AND p_preapproval_id IS DISTINCT FROM current_business.mp_preapproval_id
        AND p_preapproval_id IS DISTINCT FROM current_business.mp_pending_preapproval_id THEN
        RAISE EXCEPTION 'Suscripción no pertenece al negocio';
    END IF;

    INSERT INTO mp_pagos_aplicados(payment_id, business_id, plan_id)
        VALUES (p_payment_id, p_business_id, p_plan_id)
        ON CONFLICT (payment_id) DO NOTHING;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, current_business.mp_previous_preapproval_id;
        RETURN;
    END IF;

    old_id := CASE WHEN p_preapproval_id = current_business.mp_pending_preapproval_id
                   THEN current_business.mp_preapproval_id ELSE NULL END;
    base_date := greatest(now(), coalesce(current_business.plan_expires_at, now()));
    UPDATE businesses SET
        plan_id = p_plan_id,
        plan_status = 'active',
        plan_expires_at = base_date + interval '30 days',
        max_locations = p_max_locations,
        mp_previous_preapproval_id = coalesce(old_id, mp_previous_preapproval_id),
        mp_preapproval_id = CASE WHEN old_id IS NOT NULL OR p_preapproval_id = mp_pending_preapproval_id
                                 THEN p_preapproval_id ELSE mp_preapproval_id END,
        mp_pending_preapproval_id = CASE WHEN p_preapproval_id = mp_pending_preapproval_id
                                         THEN NULL ELSE mp_pending_preapproval_id END,
        mp_pending_plan_id = CASE WHEN p_preapproval_id = mp_pending_preapproval_id
                                  THEN NULL ELSE mp_pending_plan_id END
        WHERE id = p_business_id;

    UPDATE profiles SET approved = true WHERE id = current_business.owner_id;
    RETURN QUERY SELECT true, old_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mercadopago_payment(TEXT, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mercadopago_payment(TEXT, UUID, TEXT, INTEGER, TEXT) TO service_role;
