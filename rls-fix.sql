
-- Fix infinite recursion in profiles policies
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmin can delete profiles" ON profiles;

CREATE POLICY "Superadmin can view all profiles" ON profiles
FOR SELECT USING (
  auth.uid() = id OR (auth.jwt()->>'email' = '1133985163f@gmail.com')
);

CREATE POLICY "Superadmin can update all profiles" ON profiles
FOR UPDATE USING (
  auth.uid() = id OR (auth.jwt()->>'email' = '1133985163f@gmail.com')
);

CREATE POLICY "Superadmin can delete profiles" ON profiles
FOR DELETE USING (
  (auth.jwt()->>'email' = '1133985163f@gmail.com')
);

-- Fix businesses policies (allow insert/update for owner)
DROP POLICY IF EXISTS "Owners can update their businesses" ON businesses;
CREATE POLICY "Owners can update their businesses" ON businesses
FOR UPDATE USING (
  owner_id = auth.uid() OR (auth.jwt()->>'email' = '1133985163f@gmail.com')
);

DROP POLICY IF EXISTS "Owners can insert their businesses" ON businesses;
CREATE POLICY "Owners can insert their businesses" ON businesses
FOR INSERT WITH CHECK (
  owner_id = auth.uid() OR (auth.jwt()->>'email' = '1133985163f@gmail.com')
);

