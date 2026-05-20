-- ==========================================
-- TurnosPro Database Schema for Supabase
-- Run this in the Supabase SQL Editor
-- ==========================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'Dueño',
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
  business_type TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  roles JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to profiles after businesses is created
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
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration INTEGER DEFAULT 30,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (income & expenses)
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
  date DATE NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cancel Tokens (for email cancellation links)
CREATE TABLE IF NOT EXISTS cancel_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_tokens ENABLE ROW LEVEL SECURITY;

-- ── Profiles ──
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── Businesses ──
-- Owner full access
CREATE POLICY "Owner can manage business" ON businesses FOR ALL USING (auth.uid() = owner_id);
-- Public read for marketplace and booking
CREATE POLICY "Anyone can view businesses" ON businesses FOR SELECT USING (true);

-- ── Team members ──
CREATE POLICY "Business members access" ON team_members FOR ALL 
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
-- Public read for booking (to see professionals)
CREATE POLICY "Anyone can view team members" ON team_members FOR SELECT USING (true);

-- ── Clients ──
-- Business owner full access
CREATE POLICY "Business clients access" ON clients FOR ALL 
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
-- Clients can read their own records (by matching email)
CREATE POLICY "Clients can view own records" ON clients FOR SELECT
USING (email = (auth.jwt() ->> 'email'));
-- Anyone can insert client records (for public booking)
CREATE POLICY "Anyone can create client" ON clients FOR INSERT WITH CHECK (true);

-- ── Appointments ──
-- Business owner full access
CREATE POLICY "Business appointments access" ON appointments FOR ALL 
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
-- Clients can read their own appointments
CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT
USING (client_id IN (
  SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
));
-- Anyone can create appointments (public booking)
CREATE POLICY "Anyone can create appointment" ON appointments FOR INSERT WITH CHECK (true);
-- Clients can update own appointments (for cancellation)
CREATE POLICY "Clients can update own appointments" ON appointments FOR UPDATE
USING (client_id IN (
  SELECT id FROM clients WHERE email = (auth.jwt() ->> 'email')
));

-- ── Transactions ──
CREATE POLICY "Business transactions access" ON transactions FOR ALL 
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ── Cash closures ──
CREATE POLICY "Business cash closures access" ON cash_closures FOR ALL 
USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ── Notifications ──
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- ── Cancel Tokens ──
CREATE POLICY "Service role manages cancel tokens" ON cancel_tokens FOR ALL USING (true);

-- ==========================================
-- Indexes for performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_appointments_business_date ON appointments(business_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business_date ON transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clients_business ON clients(business_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_team_members_business ON team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_cancel_tokens_token ON cancel_tokens(token);

-- ==========================================
-- PHASE 2: Marketplaces, Reviews, Favorites
-- ==========================================

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

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users manage own reviews" ON reviews FOR ALL USING (auth.uid() = user_id);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_business ON favorites(business_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- PHASE 3/4: Marketing, Coupons, Inventory
-- ==========================================

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

CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET uses_count = uses_count + 1
  WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active coupons" ON coupons FOR SELECT USING (active = true);
CREATE POLICY "Owners manage own coupons" ON coupons FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (active = true);
CREATE POLICY "Owners manage own products" ON products FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ==========================================
-- PHASE 4: Multi-location & Employee Login
-- ==========================================

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

CREATE INDEX IF NOT EXISTS idx_locations_business ON locations(business_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view active locations') THEN
    CREATE POLICY "Anyone can view active locations" ON locations FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own locations') THEN
    CREATE POLICY "Owners manage own locations" ON locations FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Associate other entities to locations dynamically
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE cash_closures ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Team Members Enhancements (Employee Login & Location)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_accepted BOOLEAN DEFAULT false;

-- RPC for accepting employee invites
CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT)
RETURNS void AS $$
DECLARE
  v_member_id UUID;
  v_business_id UUID;
  v_role TEXT;
BEGIN
  SELECT id, business_id, role INTO v_member_id, v_business_id, v_role
  FROM team_members
  WHERE invite_token = p_token AND user_id IS NULL;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Enlace de invitación inválido o ya utilizado.';
  END IF;

  UPDATE team_members
  SET user_id = auth.uid(), invite_accepted = true, invite_token = NULL
  WHERE id = v_member_id;

  INSERT INTO profiles (id, email, full_name, role, business_id)
  VALUES (auth.uid(), auth.jwt()->>'email', '', v_role, v_business_id)
  ON CONFLICT (id) DO UPDATE
  SET role = v_role, business_id = v_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
