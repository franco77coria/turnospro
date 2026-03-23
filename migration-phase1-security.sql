-- ============================================================
-- GLOWUP (TurnosPro) — Phase 1 Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────
-- 1.1 REMINDER SUPPORT
-- ──────────────────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires';

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_pending
  ON appointments(date, status)
  WHERE reminder_sent = false OR reminder_sent IS NULL;

-- ──────────────────────────────────────────
-- 1.3 FIX RLS POLICIES
-- ──────────────────────────────────────────

-- cancel_tokens: restrict to service role only (no public policy)
DROP POLICY IF EXISTS "Service role manages cancel tokens" ON cancel_tokens;

-- clients: only authenticated users can insert
DROP POLICY IF EXISTS "Anyone can create client" ON clients;
CREATE POLICY "Authenticated can create client" ON clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- appointments: only authenticated users can insert
DROP POLICY IF EXISTS "Anyone can create appointment" ON appointments;
CREATE POLICY "Authenticated can create appointment" ON appointments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- notifications: only service role can insert (remove public policy)
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;

-- Team members can view business appointments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view business appointments') THEN
    CREATE POLICY "Team members can view business appointments" ON appointments
      FOR SELECT USING (
        business_id IN (
          SELECT business_id FROM team_members
          WHERE user_id = auth.uid() AND active = true
        )
      );
  END IF;
END $$;

-- Team members can view business clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view business clients') THEN
    CREATE POLICY "Team members can view business clients" ON clients
      FOR SELECT USING (
        business_id IN (
          SELECT business_id FROM team_members
          WHERE user_id = auth.uid() AND active = true
        )
      );
  END IF;
END $$;

-- Public view for team members (hides sensitive data from booking page)
CREATE OR REPLACE VIEW public_team_members AS
  SELECT id, business_id, name, role, active, location_id
  FROM team_members;

-- ──────────────────────────────────────────
-- 1.4 PREVENT DOUBLE BOOKING (Unique Index)
-- ──────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment
  ON appointments(business_id, team_member_id, date, time)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Atomic booking function (optional but recommended)
CREATE OR REPLACE FUNCTION book_appointment(
  p_business_id UUID,
  p_client_id UUID,
  p_team_member_id UUID,
  p_service_name TEXT,
  p_date DATE,
  p_time TIME,
  p_duration INTEGER,
  p_price NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_conflict BOOLEAN;
  v_appointment_id UUID;
BEGIN
  -- Lock rows for this business+date to prevent concurrent inserts
  PERFORM 1 FROM appointments
    WHERE business_id = p_business_id
      AND date = p_date
      AND status NOT IN ('cancelled', 'no_show')
    FOR UPDATE;

  -- Check for time overlap conflicts
  SELECT EXISTS (
    SELECT 1 FROM appointments
    WHERE business_id = p_business_id
      AND date = p_date
      AND team_member_id = p_team_member_id
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (time <= p_time AND time + (duration || ' minutes')::interval > p_time)
        OR
        (p_time <= time AND p_time + (p_duration || ' minutes')::interval > time)
      )
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'SLOT_CONFLICT: El horario ya esta ocupado';
  END IF;

  INSERT INTO appointments (business_id, client_id, team_member_id, service_name, date, time, duration, price, notes, status)
  VALUES (p_business_id, p_client_id, p_team_member_id, p_service_name, p_date, p_time, p_duration, p_price, p_notes, 'pending')
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────
-- 1.10 CHECK CONSTRAINTS
-- ──────────────────────────────────────────

-- Appointment status validation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_status') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_status
      CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

-- Duration must be positive and reasonable (max 8 hours)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_duration') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_duration
      CHECK (duration > 0 AND duration <= 480);
  END IF;
END $$;

-- Price must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_price') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_price
      CHECK (price IS NULL OR price >= 0);
  END IF;
END $$;

-- Transaction amount must be positive
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_transaction_amount') THEN
    ALTER TABLE transactions ADD CONSTRAINT chk_transaction_amount
      CHECK (amount > 0);
  END IF;
END $$;

-- Commission value must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_commission_value') THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_commission_value
      CHECK (commission_value IS NULL OR commission_value >= 0);
  END IF;
END $$;

-- Product stock must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_product_stock') THEN
    ALTER TABLE products ADD CONSTRAINT chk_product_stock CHECK (stock >= 0);
  END IF;
END $$;

-- Product price must be positive
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_product_price') THEN
    ALTER TABLE products ADD CONSTRAINT chk_product_price CHECK (price > 0);
  END IF;
END $$;

-- ──────────────────────────────────────────
-- DONE — Verify with:
-- SELECT constraint_name FROM information_schema.check_constraints WHERE constraint_schema = 'public';
-- ──────────────────────────────────────────
