-- Run this in the Supabase SQL Editor to allow all authenticated users to READ businesses
-- This is needed for the client booking page to list available businesses

-- Allow any authenticated user to read businesses (for booking page)
CREATE POLICY "Anyone can view businesses" ON businesses
FOR SELECT USING (true);

-- Allow any authenticated user to read services info for booking
-- (businesses table already covers this since services is a JSONB column)

-- Allow any authenticated user to insert clients (for booking)
CREATE POLICY "Authenticated users can create clients" ON clients
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow any authenticated user to insert appointments (for booking)
CREATE POLICY "Authenticated users can create appointments" ON appointments
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
