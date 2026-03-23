-- Phase 4: Waitlist / Caza-Turnos
-- Run this migration in Supabase SQL Editor

-- Drop if exists from a previous partial attempt
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

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can add themselves to the waitlist
CREATE POLICY "waitlist_insert" ON waitlist
    FOR INSERT WITH CHECK (true);

-- Public read for checking own entries
CREATE POLICY "waitlist_select" ON waitlist
    FOR SELECT USING (true);

-- Business owner can update (mark as notified)
CREATE POLICY "waitlist_update" ON waitlist
    FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Business owner can delete
CREATE POLICY "waitlist_delete" ON waitlist
    FOR DELETE USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Index for efficient lookups on cancellation
CREATE INDEX idx_waitlist_lookup ON waitlist (business_id, "date", notified);
