-- Phase 6: CRM Inteligente
-- Run in Supabase SQL Editor

-- Expand clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_cancellations INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_cancellation_month TEXT;

-- Expand appointments table for smart confirmation
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_required BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_deadline TIMESTAMPTZ;
