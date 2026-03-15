-- ==========================================
-- TurnosPro Full Migration
-- run this file safely (using IF NOT EXISTS)
-- to add all phase 1 to 4 features to existing DB
-- ==========================================

-- ================== PHASE 1 ================== --
-- 1. Businesses slug & type
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'otro';

-- 2. Clients enhancements
ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 0;

-- 3. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- 4. Cancel Tokens
CREATE TABLE IF NOT EXISTS cancel_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancel_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Business owners see own notifications') THEN
    CREATE POLICY "Business owners see own notifications" ON notifications
      FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()) 
        OR user_id = auth.uid()
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can manage cancel tokens') THEN
    CREATE POLICY "System can manage cancel tokens" ON cancel_tokens FOR ALL USING (true);
  END IF;
END $$;


-- ================== PHASE 2 ================== --
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

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_business ON favorites(business_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read reviews') THEN
    CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own reviews') THEN
    CREATE POLICY "Users manage own reviews" ON reviews FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own favorites') THEN
    CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- ================== PHASE 3 & 4 (Foundations) ================== --

-- Coupons (Descuentos)
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

-- Products (Venta de productos/Inventario)
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active coupons') THEN
    CREATE POLICY "Anyone can read active coupons" ON coupons FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read active products') THEN
    CREATE POLICY "Anyone can read active products" ON products FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own coupons') THEN
    CREATE POLICY "Owners manage own coupons" ON coupons FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners manage own products') THEN
    CREATE POLICY "Owners manage own products" ON products FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
  END IF;
END $$;

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

SELECT 'All phases migration complete.' AS result;
