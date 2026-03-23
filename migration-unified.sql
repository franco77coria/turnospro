-- ============================================================
-- GLOWUP (TurnosPro) — MIGRACION UNIFICADA COMPLETA
-- Ejecutar en Supabase SQL Editor
--
-- Esta query es IDEMPOTENTE (segura de ejecutar multiples veces).
-- Usa IF NOT EXISTS, DROP IF EXISTS, y DO blocks para evitar errores
-- si algo ya existe.
--
-- Incluye: Schema base + Accounts + Booking + Reminders +
--          Phase 1-4 (security, geo, services, loyalty, locations,
--          employee login) + Phase 3 closures/absences +
--          Phase 4 waitlist + Phase 6 CRM
-- ============================================================

-- ══════════════════════════════════════════
-- 0. EXTENSIONES
-- ══════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ══════════════════════════════════════════
-- 1. TABLAS BASE
-- ══════════════════════════════════════════

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  business_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  business_type TEXT NOT NULL DEFAULT 'otro',
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  roles JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK profiles -> businesses (safe, idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_business_id_fkey'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Team Members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Profesional',
  active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  commission_type TEXT DEFAULT 'percentage',
  commission_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  first_visit TIMESTAMPTZ,
  last_visit TIMESTAMPTZ,
  total_visits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  "date" DATE NOT NULL,
  "time" TIME NOT NULL,
  duration INTEGER DEFAULT 30,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  concept TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  category TEXT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Closures
CREATE TABLE IF NOT EXISTS cash_closures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  "date" DATE NOT NULL,
  total_income NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  cash_amount NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cancel Tokens
CREATE TABLE IF NOT EXISTS cancel_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, code)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations (Multi-sucursales)
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services (normalized from JSONB)
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

-- Loyalty Programs
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

-- Working Hours
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

-- Blocked Times
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

-- Audit Log
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

-- ══════════════════════════════════════════
-- 2. PHASE 3: BUSINESS CLOSURES & TEAM ABSENCES
-- ══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_closures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    "date" DATE NOT NULL,
    reason TEXT DEFAULT 'Cerrado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, "date")
);

CREATE TABLE IF NOT EXISTS team_absences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT DEFAULT 'Ausencia',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- ══════════════════════════════════════════
-- 3. PHASE 4: WAITLIST (CAZA-TURNOS)
-- ══════════════════════════════════════════

DROP TABLE IF EXISTS waitlist CASCADE;

CREATE TABLE waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    client_phone TEXT NOT NULL,
    client_name TEXT,
    client_email TEXT,
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    "date" DATE NOT NULL,
    service_name TEXT,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- 4. ALTER TABLE — COLUMNAS ADICIONALES
-- (Todos usan IF NOT EXISTS, seguro de re-ejecutar)
-- ══════════════════════════════════════════

-- Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;

-- Businesses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'email';

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES appointments(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_required BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ;

-- Transactions & Cash Closures — location support
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Team Members — employee login & location
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_accepted BOOLEAN DEFAULT false;

-- Clients — CRM (Phase 6)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_cancellations INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_cancellation_month TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ══════════════════════════════════════════
-- 5. ENABLE RLS EN TODAS LAS TABLAS
-- ══════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════
-- 6. RLS POLICIES (idempotentes con DO blocks)
-- ══════════════════════════════════════════

-- ── Profiles ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ── Businesses ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner can manage business' AND tablename = 'businesses') THEN
    CREATE POLICY "Owner can manage business" ON businesses FOR ALL USING (auth.uid() = owner_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view businesses' AND tablename = 'businesses') THEN
    CREATE POLICY "Anyone can view businesses" ON businesses FOR SELECT USING (true);
  END IF;
END $$;

-- ── Team Members ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business members access' AND tablename = 'team_members') THEN
    CREATE POLICY "Business members access" ON team_members FOR ALL
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view team members' AND tablename = 'team_members') THEN
    CREATE POLICY "Anyone can view team members" ON team_members FOR SELECT USING (true);
  END IF;
END $$;

-- ── Clients ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business clients access' AND tablename = 'clients') THEN
    CREATE POLICY "Business clients access" ON clients FOR ALL
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own records' AND tablename = 'clients') THEN
    CREATE POLICY "Clients can view own records" ON clients FOR SELECT
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can create client' AND tablename = 'clients') THEN
    CREATE POLICY "Authenticated can create client" ON clients FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view business clients' AND tablename = 'clients') THEN
    CREATE POLICY "Team members can view business clients" ON clients FOR SELECT
    USING (business_id IN (SELECT business_id FROM team_members WHERE user_id = auth.uid() AND active = true));
  END IF;
END $$;

-- ── Appointments ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business appointments access' AND tablename = 'appointments') THEN
    CREATE POLICY "Business appointments access" ON appointments FOR ALL
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view own appointments' AND tablename = 'appointments') THEN
    CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT
    USING (client_id IN (SELECT id FROM clients WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated can create appointment' AND tablename = 'appointments') THEN
    CREATE POLICY "Authenticated can create appointment" ON appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can update own appointments' AND tablename = 'appointments') THEN
    CREATE POLICY "Clients can update own appointments" ON appointments FOR UPDATE
    USING (client_id IN (SELECT id FROM clients WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view business appointments' AND tablename = 'appointments') THEN
    CREATE POLICY "Team members can view business appointments" ON appointments FOR SELECT
    USING (business_id IN (SELECT business_id FROM team_members WHERE user_id = auth.uid() AND active = true));
  END IF;
END $$;

-- ── Transactions ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business transactions access' AND tablename = 'transactions') THEN
    CREATE POLICY "Business transactions access" ON transactions FOR ALL
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Cash Closures ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business cash closures access' AND tablename = 'cash_closures') THEN
    CREATE POLICY "Business cash closures access" ON cash_closures FOR ALL
    USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Notifications ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own notifications' AND tablename = 'notifications') THEN
    CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ── Cancel Tokens ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role manages cancel tokens' AND tablename = 'cancel_tokens') THEN
    CREATE POLICY "Service role manages cancel tokens" ON cancel_tokens FOR ALL USING (true);
  END IF;
END $$;

-- ── Reviews ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read reviews' AND tablename = 'reviews') THEN
    CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create reviews' AND tablename = 'reviews') THEN
    CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own reviews' AND tablename = 'reviews') THEN
    CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own reviews' AND tablename = 'reviews') THEN
    CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Favorites ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own favorites' AND tablename = 'favorites') THEN
    CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Coupons ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active coupons' AND tablename = 'coupons') THEN
    CREATE POLICY "Anyone can read active coupons" ON coupons FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own coupons' AND tablename = 'coupons') THEN
    CREATE POLICY "Owners manage own coupons" ON coupons FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Products ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active products' AND tablename = 'products') THEN
    CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own products' AND tablename = 'products') THEN
    CREATE POLICY "Owners manage own products" ON products FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Locations ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view active locations' AND tablename = 'locations') THEN
    CREATE POLICY "Anyone can view active locations" ON locations FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own locations' AND tablename = 'locations') THEN
    CREATE POLICY "Owners manage own locations" ON locations FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Services ──
DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services" ON services FOR SELECT USING (active = true);
DROP POLICY IF EXISTS "Owners can manage services" ON services;
CREATE POLICY "Owners can manage services" ON services FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ── Business Closures ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'business_closures_select' AND tablename = 'business_closures') THEN
    CREATE POLICY "business_closures_select" ON business_closures FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'business_closures_insert' AND tablename = 'business_closures') THEN
    CREATE POLICY "business_closures_insert" ON business_closures FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'business_closures_update' AND tablename = 'business_closures') THEN
    CREATE POLICY "business_closures_update" ON business_closures FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'business_closures_delete' AND tablename = 'business_closures') THEN
    CREATE POLICY "business_closures_delete" ON business_closures FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Team Absences ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_absences_select' AND tablename = 'team_absences') THEN
    CREATE POLICY "team_absences_select" ON team_absences FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_absences_insert' AND tablename = 'team_absences') THEN
    CREATE POLICY "team_absences_insert" ON team_absences FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_absences_update' AND tablename = 'team_absences') THEN
    CREATE POLICY "team_absences_update" ON team_absences FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'team_absences_delete' AND tablename = 'team_absences') THEN
    CREATE POLICY "team_absences_delete" ON team_absences FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Waitlist ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waitlist_insert' AND tablename = 'waitlist') THEN
    CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waitlist_select' AND tablename = 'waitlist') THEN
    CREATE POLICY "waitlist_select" ON waitlist FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waitlist_update' AND tablename = 'waitlist') THEN
    CREATE POLICY "waitlist_update" ON waitlist FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'waitlist_delete' AND tablename = 'waitlist') THEN
    CREATE POLICY "waitlist_delete" ON waitlist FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- ── Audit Log ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owner views audit log' AND tablename = 'audit_log') THEN
    CREATE POLICY "Owner views audit log" ON audit_log FOR SELECT USING (
      business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );
  END IF;
END $$;

-- ══════════════════════════════════════════
-- 7. INDEXES
-- ══════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_appointments_business_date ON appointments(business_id, "date");
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_team_members_business ON team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(business_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_cancel_tokens_token ON cancel_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_business ON favorites(business_id);
CREATE INDEX IF NOT EXISTS idx_locations_business ON locations(business_id);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_blocked_times_business ON blocked_times(business_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_business ON audit_log(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_business_closures_lookup ON business_closures(business_id, "date");
CREATE INDEX IF NOT EXISTS idx_team_absences_lookup ON team_absences(business_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_lookup ON waitlist(business_id, "date", notified);
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING gin (name gin_trgm_ops);

-- Unique index to prevent double booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment
  ON appointments(business_id, team_member_id, "date", "time")
  WHERE status NOT IN ('cancelled', 'no_show');

-- Reminder pending index
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_pending
  ON appointments("date", status)
  WHERE reminder_sent = false OR reminder_sent IS NULL;

-- Notifications unread fast lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = false;

-- Team members active only
CREATE INDEX IF NOT EXISTS idx_team_members_business_active
  ON team_members(business_id) WHERE active = true;

-- Prevent duplicate clients per business (same email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_client_email
  ON clients(business_id, email) WHERE email IS NOT NULL AND email != '';

-- Prevent duplicate clients per business (same phone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_client_phone
  ON clients(business_id, phone) WHERE phone IS NOT NULL AND phone != '';

-- Prevent duplicate waitlist entries (same phone, same business, same date, not yet notified)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_waitlist_entry
  ON waitlist(business_id, client_phone, "date") WHERE notified = false;

-- Unique email on profiles (matches auth.users unique email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_profile_email
  ON profiles(email) WHERE email IS NOT NULL AND email != '';

-- ══════════════════════════════════════════
-- 8. FUNCIONES Y TRIGGERS
-- ══════════════════════════════════════════

-- Increment coupon uses
CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons SET uses_count = uses_count + 1 WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-approve users trigger
CREATE OR REPLACE FUNCTION auto_approve_users()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_type = 'user' THEN
        NEW.approved = true;
    END IF;
    IF NEW.email = '1133985163f@gmail.com' THEN
        NEW.account_type = 'superadmin';
        NEW.approved = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_approve_trigger ON profiles;
CREATE TRIGGER auto_approve_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_users();

-- Update business avg_rating on review change
CREATE OR REPLACE FUNCTION update_business_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE businesses
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews
      WHERE business_id = COALESCE(NEW.business_id, OLD.business_id)
    ), 0),
    total_reviews = (
      SELECT COUNT(*) FROM reviews
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

-- Atomic booking function (prevents double booking via row lock)
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
  PERFORM 1 FROM appointments
    WHERE business_id = p_business_id AND "date" = p_date
      AND status NOT IN ('cancelled', 'no_show')
    FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM appointments
    WHERE business_id = p_business_id AND "date" = p_date
      AND team_member_id = p_team_member_id
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        ("time" <= p_time AND "time" + (duration || ' minutes')::interval > p_time)
        OR
        (p_time <= "time" AND p_time + (p_duration || ' minutes')::interval > "time")
      )
  ) INTO v_conflict;

  IF v_conflict THEN
    RAISE EXCEPTION 'SLOT_CONFLICT: El horario ya esta ocupado';
  END IF;

  INSERT INTO appointments (business_id, client_id, team_member_id, service_name, "date", "time", duration, price, notes, status)
  VALUES (p_business_id, p_client_id, p_team_member_id, p_service_name, p_date, p_time, p_duration, p_price, p_notes, 'pending')
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept employee invite
CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT)
RETURNS void AS $$
DECLARE
  v_member_id UUID;
  v_business_id UUID;
  v_role TEXT;
BEGIN
  SELECT id, business_id, role INTO v_member_id, v_business_id, v_role
  FROM team_members WHERE invite_token = p_token AND user_id IS NULL;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Enlace de invitacion invalido o ya utilizado.';
  END IF;

  UPDATE team_members
  SET user_id = auth.uid(), invite_accepted = true, invite_token = NULL
  WHERE id = v_member_id;

  INSERT INTO profiles (id, email, full_name, role, business_id)
  VALUES (auth.uid(), auth.jwt()->>'email', '', v_role, v_business_id)
  ON CONFLICT (id) DO UPDATE SET role = v_role, business_id = v_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public view for team members (safe for booking page)
CREATE OR REPLACE VIEW public_team_members AS
  SELECT id, business_id, name, role, active, location_id
  FROM team_members;

-- ══════════════════════════════════════════
-- 9. CHECK CONSTRAINTS
-- ══════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_status') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_status
      CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_duration') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_duration
      CHECK (duration > 0 AND duration <= 480);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_appointment_price') THEN
    ALTER TABLE appointments ADD CONSTRAINT chk_appointment_price
      CHECK (price IS NULL OR price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_transaction_amount') THEN
    ALTER TABLE transactions ADD CONSTRAINT chk_transaction_amount CHECK (amount > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_commission_value') THEN
    ALTER TABLE team_members ADD CONSTRAINT chk_commission_value CHECK (commission_value IS NULL OR commission_value >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_product_stock') THEN
    ALTER TABLE products ADD CONSTRAINT chk_product_stock CHECK (stock >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_product_price') THEN
    ALTER TABLE products ADD CONSTRAINT chk_product_price CHECK (price > 0);
  END IF;
END $$;

-- ══════════════════════════════════════════
-- 10. BACKFILL (safe to re-run)
-- ══════════════════════════════════════════

-- Backfill business ratings from existing reviews
UPDATE businesses
SET
  avg_rating = COALESCE(sub.avg, 0),
  total_reviews = COALESCE(sub.cnt, 0)
FROM (
  SELECT business_id, ROUND(AVG(rating)::numeric, 2) as avg, COUNT(*) as cnt
  FROM reviews GROUP BY business_id
) sub
WHERE businesses.id = sub.business_id;

-- Set superadmin
UPDATE profiles SET account_type = 'superadmin', approved = true WHERE email = '1133985163f@gmail.com';

-- ══════════════════════════════════════════
-- DONE
-- ══════════════════════════════════════════
SELECT 'Migracion unificada completa.' AS resultado;
