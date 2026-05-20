-- ==========================================
-- TurnosPro Migration: Phase 1 Features
-- Run this in Supabase SQL Editor to add
-- the new features to an existing database
-- ==========================================

-- 1. Add slug column to businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);

-- 2. Add missing columns to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- 4. Create cancel_tokens table
CREATE TABLE IF NOT EXISTS cancel_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cancel_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cancel_tokens_token ON cancel_tokens(token);

-- 5. Add appointment client index
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);

-- ==========================================
-- New RLS Policies
-- ==========================================

-- Businesses: anyone can view (for marketplace)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view businesses' AND tablename = 'businesses'
  ) THEN
    CREATE POLICY "Anyone can view businesses" ON businesses FOR SELECT USING (true);
  END IF;
END $$;

-- Team members: public read for booking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view team members' AND tablename = 'team_members'
  ) THEN
    CREATE POLICY "Anyone can view team members" ON team_members FOR SELECT USING (true);
  END IF;
END $$;

-- Clients: can view own records by email
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own records' AND tablename = 'clients'
  ) THEN
    CREATE POLICY "Clients can view own records" ON clients FOR SELECT
    USING (email = (auth.jwt() ->> 'email'));
  END IF;
END $$;

-- Clients: anyone can create (for public booking)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can create client' AND tablename = 'clients'
  ) THEN
    CREATE POLICY "Anyone can create client" ON clients FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Appointments: clients can view own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own appointments' AND tablename = 'appointments'
  ) THEN
    CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT
    USING (client_id IN (
      SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
    ));
  END IF;
END $$;

-- Appointments: anyone can create (public booking)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can create appointment' AND tablename = 'appointments'
  ) THEN
    CREATE POLICY "Anyone can create appointment" ON appointments FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Appointments: clients can update own (for cancellation)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Clients can update own appointments' AND tablename = 'appointments'
  ) THEN
    CREATE POLICY "Clients can update own appointments" ON appointments FOR UPDATE
    USING (client_id IN (
      SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
    ));
  END IF;
END $$;

-- Notifications: users can view/update own, anyone can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert notifications' AND tablename = 'notifications'
  ) THEN
    CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Cancel tokens: full access (managed by service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role manages cancel tokens' AND tablename = 'cancel_tokens'
  ) THEN
    CREATE POLICY "Service role manages cancel tokens" ON cancel_tokens FOR ALL USING (true);
  END IF;
END $$;

-- Done!
SELECT 'Migration complete: Phase 1 features applied.' AS result;
