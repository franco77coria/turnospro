-- =============================================
-- TURNOSPRO / GLOWUP — Database Migrations
-- Run these in Supabase SQL Editor in order
-- =============================================

-- Migration 1: Dedicated reminder tracking column
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Migration 2: Add unique IDs to existing services (one-time)
UPDATE businesses
SET services = (
    SELECT jsonb_agg(
        CASE
            WHEN elem->>'id' IS NULL THEN jsonb_set(elem, '{id}', to_jsonb(gen_random_uuid()::text))
            ELSE elem
        END
    )
    FROM jsonb_array_elements(services) AS elem
)
WHERE services IS NOT NULL AND jsonb_array_length(services) > 0;

-- Migration 3: Business slug for branded booking URLs
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);

-- Migration 4: Cancellation policy setting (stored in settings JSONB, no schema change needed)

-- Migration 5: Recurring appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence JSONB;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS parent_appointment_id UUID REFERENCES appointments(id);

-- Migration 6: Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own notifications') THEN
        CREATE POLICY "Users see own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
