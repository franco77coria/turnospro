-- Run this in Supabase SQL Editor
-- Adds reminder_sent column for appointment reminders

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
