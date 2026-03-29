-- ============================================================
-- CLEANUP: eliminar todos los usuarios y negocios excepto el dueño
-- Dueño: 1133985163F@gmail.com | franco.coria.r@gmail.com
-- Ejecutar en Supabase SQL Editor (en orden)
-- ============================================================

-- IDs del dueño (para referencia, reemplazar si cambian)
-- SELECT id, email FROM auth.users WHERE LOWER(email) IN ('1133985163f@gmail.com', 'franco.coria.r@gmail.com');

-- 1. Eliminar negocios que NO son del dueño
DELETE FROM public.businesses
WHERE owner_id NOT IN (
    SELECT id FROM auth.users
    WHERE LOWER(email) IN ('1133985163f@gmail.com', 'franco.coria.r@gmail.com')
);

-- 2. Eliminar perfiles que NO son del dueño
DELETE FROM public.profiles
WHERE id NOT IN (
    SELECT id FROM auth.users
    WHERE LOWER(email) IN ('1133985163f@gmail.com', 'franco.coria.r@gmail.com')
);

-- 3. Eliminar usuarios de auth (esto puede fallar si hay FK constraints activas)
--    Si falla, usar el panel de Supabase → Authentication → Users
DELETE FROM auth.users
WHERE LOWER(email) NOT IN ('1133985163f@gmail.com', 'franco.coria.r@gmail.com');

-- Verificar resultado
SELECT id, email, created_at FROM auth.users ORDER BY created_at;
SELECT id, email, role, business_id FROM public.profiles;
SELECT id, name, owner_id FROM public.businesses;
