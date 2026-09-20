-- =========================================================================
-- AJUSTE DE PLANES Y ASIGNACIÓN DE NEGOCIO DE PRUEBA (GLOWUP & BARONE)
-- =========================================================================

-- 1. Barone Barber: ajuste de período de prueba al 10/10/2026
UPDATE public.businesses
SET plan_expires_at = '2026-10-10 23:59:59-03'
WHERE id = 'ba401614-f1bc-4868-bd6e-5f98945dbb2f';

-- 2. GLOWUP: Negocio de prueba propio - quitar límites (plan activo sin vencimiento)
UPDATE public.businesses
SET 
    plan_id = 'pro',
    plan_status = 'active',
    plan_expires_at = '2099-12-31 23:59:59+00', -- Ilimitado / perpetuo
    max_locations = 99,
    slug = NULL -- Mantener sin slug público para que no aparezca en búsquedas de clientes
WHERE id = '529f9998-073c-4a0f-97de-41abebf1df58';

-- 3. Asignar owner_id de GLOWUP a franco.coria.r@gmail.com
UPDATE public.businesses
SET owner_id = u.id
FROM auth.users u
WHERE public.businesses.id = '529f9998-073c-4a0f-97de-41abebf1df58'
  AND lower(u.email) = 'franco.coria.r@gmail.com';

-- 4. Vincular perfiles de franco.coria.r@gmail.com y 1133985163f@gmail.com como Dueños de GLOWUP
INSERT INTO public.profiles (id, email, business_id, role, account_type, approved)
SELECT u.id, u.email, '529f9998-073c-4a0f-97de-41abebf1df58', 'Dueño', 'business', true
FROM auth.users u
WHERE lower(u.email) IN ('franco.coria.r@gmail.com', '1133985163f@gmail.com')
ON CONFLICT (id) DO UPDATE
SET business_id = '529f9998-073c-4a0f-97de-41abebf1df58',
    role = 'Dueño',
    account_type = 'business',
    approved = true;

-- 5. Asegurar política RLS para que ambos dueños puedan administrar GLOWUP en el dashboard
DROP POLICY IF EXISTS "Owners can update own business" ON public.businesses;
CREATE POLICY "Owners can update own business" ON public.businesses FOR UPDATE USING (
    owner_id = auth.uid()
    OR id IN (
        SELECT business_id FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'Dueño' OR account_type = 'business')
    )
);

-- Verificación de resultados:
SELECT b.name, b.plan_id, b.plan_status, b.plan_expires_at, u.email as owner_email
FROM businesses b
LEFT JOIN auth.users u ON b.owner_id = u.id;
