-- Run this in Supabase SQL Editor AFTER the initial schema
-- Adds account type and approval system

-- Add account_type and approved fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'user' CHECK (account_type IN ('user', 'business', 'superadmin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;

-- Auto-approve superadmin
UPDATE profiles SET account_type = 'superadmin', approved = true WHERE email = '1133985163f@gmail.com';

-- Auto-approve all user-type accounts
CREATE OR REPLACE FUNCTION auto_approve_users()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_type = 'user' THEN
        NEW.approved = true;
    END IF;
    IF NEW.email = '1133985163f@gmail.com' THEN
        NEW.account_type = 'superadmin';
        NEW.approved = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_approve_trigger ON profiles;
CREATE TRIGGER auto_approve_trigger
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_users();
