-- ============================================================
-- GLOWUP (TurnosPro) — Phase 3 Remaining Database Migration
-- Run AFTER migration-phase2-4.sql
-- ============================================================

-- ──────────────────────────────────────────
-- 3.1 TRIGRAM INDEX FOR FULL-TEXT SEARCH
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING gin (name gin_trgm_ops);

-- ──────────────────────────────────────────
-- 3.2 WAITLIST TABLE
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  client_name TEXT,
  client_phone TEXT,
  service_name TEXT,
  preferred_date DATE,
  preferred_time_start TIME,
  preferred_time_end TIME,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'expired')),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_business ON waitlist(business_id, status);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages waitlist" ON waitlist FOR ALL USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);
CREATE POLICY "Public can join waitlist" ON waitlist FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────
-- 3.3 AUDIT LOG TABLE
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_log(business_id, created_at);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner views audit log" ON audit_log FOR SELECT USING (
  business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
);

-- ──────────────────────────────────────────
-- 3.4 WHATSAPP NOTIFICATION FIELDS
-- ──────────────────────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('email', 'whatsapp', 'both'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ──────────────────────────────────────────
-- DONE
-- ──────────────────────────────────────────
