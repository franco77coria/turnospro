-- ==============================================================================
-- MIGRACIÓN: Blindaje de límite de sucursales por plan (Hard-Enforcement)
-- ==============================================================================
-- Evita que cualquier usuario o petición pueda insertar más sucursales que las
-- permitidas por el campo `max_locations` del negocio en la tabla `businesses`.
--
-- Reglas de negocio:
-- - Plan Pro ($20.000): max_locations = 1
-- - Plan Múltiples Sucursales ($35.000): max_locations = 3
-- - Plan Personalizado: max_locations > 3 (definido a medida)
-- ==============================================================================

CREATE OR REPLACE FUNCTION check_max_locations_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max_locations INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Obtener el límite configurado para el negocio
    SELECT COALESCE(max_locations, 1)
    INTO v_max_locations
    FROM businesses
    WHERE id = NEW.business_id;

    -- Si no existe el negocio, permitimos continuar y dejamos que la foreign key falle si aplica
    IF v_max_locations IS NULL THEN
        v_max_locations := 1;
    END IF;

    -- Contar las sucursales existentes para este negocio
    SELECT COUNT(*)
    INTO v_current_count
    FROM locations
    WHERE business_id = NEW.business_id;

    -- Si ya alcanzó o superó el tope permitido, rechazar la inserción
    IF v_current_count >= v_max_locations THEN
        RAISE EXCEPTION 'Límite de sucursales alcanzado (% de %). Tu plan actual no permite agregar más sucursales. Actualizá tu suscripción para continuar.', 
            v_current_count, v_max_locations
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropear el trigger si ya existiera para evitar duplicados
DROP TRIGGER IF EXISTS trg_check_max_locations_limit ON locations;

-- Crear el trigger BEFORE INSERT
CREATE TRIGGER trg_check_max_locations_limit
    BEFORE INSERT ON locations
    FOR EACH ROW
    EXECUTE FUNCTION check_max_locations_limit();
