-- ================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Fixes: admin approvals, missing columns, RLS
-- ================================================

-- 1) Add missing columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'business';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;

-- 2) Allow superadmin to read ALL profiles (not just their own)
CREATE POLICY "Superadmin can view all profiles" ON profiles
FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE email = '1133985163f@gmail.com'
  )
  OR auth.uid() = id
);

-- 3) Allow superadmin to update ALL profiles (for approve/reject)
CREATE POLICY "Superadmin can update all profiles" ON profiles
FOR UPDATE USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE email = '1133985163f@gmail.com'
  )
  OR auth.uid() = id
);

-- 4) Allow superadmin to delete profiles (for reject)
CREATE POLICY "Superadmin can delete profiles" ON profiles
FOR DELETE USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE email = '1133985163f@gmail.com'
  )
);

-- 5) Allow public to read businesses (needed for booking page)
CREATE POLICY "Anyone can read businesses for booking" ON businesses
FOR SELECT USING (true);
