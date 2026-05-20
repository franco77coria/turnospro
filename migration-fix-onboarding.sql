-- MIGRACIÓN DE REPARACIÓN DE FLUJO DE ONBOARDING PARA CLIENTES
-- Ejecuta este script en el Editor SQL de Supabase para corregir y prevenir redirecciones erróneas a /onboarding.

-- 1. Modificar el valor por defecto de la columna 'role' en 'profiles' para que sea 'user'
-- Esto previene que perfiles creados por triggers automáticos de base de datos queden con el rol de 'Dueño'
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';

-- 2. Corregir los perfiles existentes de usuarios clientes que quedaron con rol 'Dueño' de forma incorrecta
-- Si un usuario es de tipo 'user' (cliente), no tiene negocio asociado, pero su rol quedó en 'Dueño' debido al valor por defecto anterior, lo restauramos a 'user'.
UPDATE profiles 
SET role = 'user' 
WHERE account_type = 'user' 
  AND role = 'Dueño' 
  AND business_id IS NULL;

-- 3. Asegurar que el trigger de auto-aprobación apruebe correctamente a los perfiles de tipo 'user'
CREATE OR REPLACE FUNCTION auto_approve_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Forzar rol 'user' si la cuenta es de tipo 'user' para evitar desincronizaciones en base de datos
    IF NEW.account_type = 'user' THEN
        NEW.role = 'user';
        NEW.approved = true;
    END IF;
    
    -- Manejo especial de superadmin
    IF NEW.email = '1133985163f@gmail.com' THEN
        NEW.account_type = 'superadmin';
        NEW.role = 'superadmin';
        NEW.approved = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
