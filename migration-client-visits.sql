-- =========================================================================
-- MIGRACIÓN: CONTADOR AUTOMÁTICO DE VISITAS DE CLIENTES (total_visits)
-- =========================================================================

-- 1. Asegurar que las columnas existen en 'clients'
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;

-- 2. Función para sincronizar visitas de un cliente dado
CREATE OR REPLACE FUNCTION public.sync_client_visits(target_client_id UUID)
RETURNS VOID AS $$
BEGIN
  IF target_client_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.clients
  SET 
    total_visits = COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.appointments
      WHERE client_id = target_client_id
        AND status = 'completed'
    ), 0),
    first_visit = (
      SELECT MIN((date + time)::timestamptz)
      FROM public.appointments
      WHERE client_id = target_client_id
        AND status = 'completed'
    ),
    last_visit = (
      SELECT MAX((date + time)::timestamptz)
      FROM public.appointments
      WHERE client_id = target_client_id
        AND status = 'completed'
    )
  WHERE id = target_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función trigger que se ejecuta al insertar, modificar o eliminar turnos
CREATE OR REPLACE FUNCTION public.trg_sync_client_visits_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.client_id IS NOT NULL AND NEW.status = 'completed' THEN
      PERFORM public.sync_client_visits(NEW.client_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si el turno cambió a o desde 'completed', o cambió de cliente, o cambió fecha/hora de turno completado
    IF (NEW.status = 'completed' OR OLD.status = 'completed') THEN
      IF NEW.client_id IS NOT NULL THEN
        PERFORM public.sync_client_visits(NEW.client_id);
      END IF;
      IF OLD.client_id IS NOT NULL AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
        PERFORM public.sync_client_visits(OLD.client_id);
      END IF;
    ELSIF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      IF NEW.client_id IS NOT NULL THEN
        PERFORM public.sync_client_visits(NEW.client_id);
      END IF;
      IF OLD.client_id IS NOT NULL THEN
        PERFORM public.sync_client_visits(OLD.client_id);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.client_id IS NOT NULL AND OLD.status = 'completed' THEN
      PERFORM public.sync_client_visits(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asignar el trigger a la tabla appointments
DROP TRIGGER IF EXISTS trg_appointments_client_visits ON public.appointments;
CREATE TRIGGER trg_appointments_client_visits
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_client_visits_on_appointment();

-- 5. BACKFILL: Sincronizar todos los clientes existentes con sus visitas reales históricas
UPDATE public.clients c
SET 
  total_visits = COALESCE(sub.completed_count, 0),
  first_visit  = sub.min_visit,
  last_visit   = sub.max_visit
FROM (
  SELECT 
    client_id,
    COUNT(*)::INTEGER AS completed_count,
    MIN((date + time)::timestamptz) AS min_visit,
    MAX((date + time)::timestamptz) AS max_visit
  FROM public.appointments
  WHERE status = 'completed' AND client_id IS NOT NULL
  GROUP BY client_id
) sub
WHERE c.id = sub.client_id;

-- Asegurar que los clientes sin turnos completados queden en 0 en vez de null
UPDATE public.clients
SET total_visits = 0
WHERE total_visits IS NULL;
