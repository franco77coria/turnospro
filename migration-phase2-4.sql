-- ============================================================
-- GLOWUP (TurnosPro) — Phase 2-4 Database Migration
-- Run AFTER migration-phase1-security.sql
-- ============================================================

-- ──────────────────────────────────────────
-- 2.3 BUSINESS COVER IMAGE SUPPORT
-- ──────────────────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- ──────────────────────────────────────────
-- 4.1 GEO-SEARCH SUPPORT
-- ──────────────────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ──────────────────────────────────────────
-- 4.8 PERFORMANCE INDEXES
-- ──────────────────────────────────────────

-- Faster appointment lookups by business + date
CREATE INDEX IF NOT EXISTS idx_appointments_business_date
  ON appointments(business_id, date);

-- Faster appointment lookups by client
CREATE INDEX IF NOT EXISTS idx_appointments_client
  ON appointments(client_id);

-- Faster business search by type
CREATE INDEX IF NOT EXISTS idx_businesses_type
  ON businesses(business_type);

-- Faster business search by slug
CREATE INDEX IF NOT EXISTS idx_businesses_slug
  ON businesses(slug) WHERE slug IS NOT NULL;

-- Faster team member lookups
CREATE INDEX IF NOT EXISTS idx_team_members_business
  ON team_members(business_id) WHERE active = true;

-- Faster notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = false;

-- Faster transaction reporting
CREATE INDEX IF NOT EXISTS idx_transactions_business_date
  ON transactions(business_id, created_at);

-- Faster client search by business
CREATE INDEX IF NOT EXISTS idx_clients_business
  ON clients(business_id);

-- Faster review lookups
CREATE INDEX IF NOT EXISTS idx_reviews_business
  ON reviews(business_id);

-- ──────────────────────────────────────────
-- 4.8 MATERIALIZED AVERAGE RATING (for search/sort)
-- ──────────────────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- Function to update avg_rating when reviews change
CREATE OR REPLACE FUNCTION update_business_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE businesses
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
    )
  WHERE id = COALESCE(NEW.business_id, OLD.business_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_business_rating ON reviews;
CREATE TRIGGER trg_update_business_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_business_rating();

-- Backfill existing ratings
UPDATE businesses
SET
  avg_rating = COALESCE(sub.avg, 0),
  total_reviews = COALESCE(sub.cnt, 0)
FROM (
  SELECT business_id, ROUND(AVG(rating)::numeric, 2) as avg, COUNT(*) as cnt
  FROM reviews
  GROUP BY business_id
) sub
WHERE businesses.id = sub.business_id;

-- ──────────────────────────────────────────
-- 4.8 WORKING HOURS TABLE (optional, future migration from JSONB)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS working_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, day_of_week)
);

-- ──────────────────────────────────────────
-- 4.8 BLOCKED TIMES TABLE (vacations, breaks, etc.)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Bloqueado',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_times_business
  ON blocked_times(business_id, start_date, end_date);

-- ──────────────────────────────────────────
-- 3.3 SERVICES TABLE (normalize from JSONB)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL DEFAULT 30 CHECK (duration > 0 AND duration <= 480),
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  category TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_business
  ON services(business_id) WHERE active = true;

-- RLS for services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services" ON services
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Owners can manage services" ON services;
CREATE POLICY "Owners can manage services" ON services
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- 3.6 LOYALTY PROGRAM TABLES
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Programa de fidelidad',
  points_per_visit INTEGER DEFAULT 10,
  points_per_currency NUMERIC DEFAULT 0.1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES loyalty_programs(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, client_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES loyalty_programs(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust')),
  description TEXT,
  appointment_id UUID REFERENCES appointments(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────
-- 4.2 RECURRING APPOINTMENTS SUPPORT
-- ──────────────────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES appointments(id);

-- ──────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────
