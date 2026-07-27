-- =========================================================================
-- MIGRACIÓN DE SUSCRIPCIONES B2B MERCADO PAGO Y CORRECCIÓN DE ONBOARDING
-- =========================================================================

-- 1. Agregar columnas de suscripción a la tabla 'businesses'
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50) DEFAULT 'trial';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_status VARCHAR(50) DEFAULT 'trialing';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS max_locations INTEGER DEFAULT 1;

-- 2. Asegurar columnas en 'profiles' para evitar bloqueos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'user';

-- Actualizar negocios existentes para que estén en prueba de 7 días o activos si ya tienen servicios
UPDATE businesses 
SET plan_id = 'trial', 
    plan_status = 'trialing', 
    plan_expires_at = GREATEST(plan_expires_at, NOW() + INTERVAL '7 days'),
    max_locations = CASE 
        WHEN plan_id = 'multi' THEN 3 
        ELSE 1 
    END
WHERE plan_id IS NULL OR plan_status IS NULL;

-- 3. Auto-aprobar todos los perfiles de dueños para que nunca queden atrapados
UPDATE profiles 
SET approved = true 
WHERE role = 'Dueño' OR account_type = 'business';

-- 4. Asegurar la tabla 'locations' (sucursales) y sus políticas de RLS
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS en locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active locations" ON public.locations;
CREATE POLICY "Anyone can view active locations" ON public.locations FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Owners manage own locations" ON public.locations;
CREATE POLICY "Owners manage own locations" ON public.locations FOR ALL USING (
    business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
);

-- 5. Política para que los dueños puedan actualizar su propio negocio (incluyendo suscripciones)
DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
CREATE POLICY "Owners can update own business" ON public.businesses FOR UPDATE USING (
    owner_id = auth.uid()
);

-- 6. Trigger para auto-aprobar cuentas de negocio al crearse o actualizarse
CREATE OR REPLACE FUNCTION auto_approve_business_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_type = 'business' OR NEW.role = 'Dueño' THEN
        NEW.approved = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_approve_business ON profiles;
CREATE TRIGGER trg_auto_approve_business
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION auto_approve_business_profile();
