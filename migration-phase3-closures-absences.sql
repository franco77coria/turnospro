-- Phase 3: Business Closures & Team Absences
-- Run this migration in Supabase SQL Editor

-- Business-level closures (holidays, special closures)
CREATE TABLE IF NOT EXISTS business_closures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    reason TEXT DEFAULT 'Cerrado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, date)
);

ALTER TABLE business_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_closures_select" ON business_closures
    FOR SELECT USING (true);
CREATE POLICY "business_closures_insert" ON business_closures
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "business_closures_update" ON business_closures
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "business_closures_delete" ON business_closures
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Team member absences (vacations, sick days)
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

ALTER TABLE team_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_absences_select" ON team_absences
    FOR SELECT USING (true);
CREATE POLICY "team_absences_insert" ON team_absences
    FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "team_absences_update" ON team_absences
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "team_absences_delete" ON team_absences
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_business_closures_lookup ON business_closures (business_id, date);
CREATE INDEX IF NOT EXISTS idx_team_absences_lookup ON team_absences (business_id, start_date, end_date);

-- Add phone column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
