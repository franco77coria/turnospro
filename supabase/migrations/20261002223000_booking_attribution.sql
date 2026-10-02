ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'direct';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_booking_source_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_booking_source_check
      CHECK (booking_source IN ('direct', 'search', 'map', 'flyer'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS appointments_business_source_date_idx
  ON public.appointments (business_id, booking_source, date);

COMMENT ON COLUMN public.appointments.booking_source IS
  'Canal atribuido al crear la reserva: direct, search, map o flyer.';
