-- =========================================================================
-- MIGRACIÓN DE SEGURIDAD — cancel tokens de un solo uso
-- =========================================================================
-- La tabla cancel_tokens ya existe en el schema base pero nunca se estaba
-- usando para rastrear el consumo. Como los tokens HMAC son válidos 30 días,
-- un token capturado de un email se puede reutilizar mientras el turno
-- exista. Marcar tokens como usados convierte la cancelación en una
-- operación idempotente y elimina la ventana de re-uso.
--
-- Esta migración:
--   1. Garantiza que la tabla cancel_tokens tenga las columnas necesarias.
--   2. Restringe el acceso solo al service role (no policies para anon/auth).
--   3. Agrega índice para lookups por appointment_id.
-- =========================================================================

CREATE TABLE IF NOT EXISTS cancel_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if the table was created with an older schema
ALTER TABLE cancel_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE cancel_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Backfill token_hash from legacy `token` column if both exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cancel_tokens' AND column_name = 'token'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cancel_tokens' AND column_name = 'token_hash'
    ) THEN
        UPDATE cancel_tokens SET token_hash = token WHERE token_hash IS NULL AND token IS NOT NULL;
    END IF;
END $$;

-- Ensure the unique constraint exists on token_hash
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'cancel_tokens' AND indexname = 'cancel_tokens_token_hash_key'
    ) THEN
        BEGIN
            CREATE UNIQUE INDEX cancel_tokens_token_hash_key ON cancel_tokens(token_hash) WHERE token_hash IS NOT NULL;
        EXCEPTION WHEN duplicate_table THEN
            -- already exists
            NULL;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cancel_tokens_appointment ON cancel_tokens(appointment_id);

-- Lock down access — only the service role (server-side admin client) reads/writes.
-- Removing any anon/auth policy means clients can't enumerate or modify tokens.
ALTER TABLE cancel_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages cancel tokens" ON cancel_tokens;
-- (No CREATE POLICY here: RLS without policies blocks everyone except service_role.)

-- Helper to clean up expired/used tokens (run periodically if desired)
CREATE OR REPLACE FUNCTION cleanup_expired_cancel_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cancel_tokens
    WHERE (used = true AND used_at < NOW() - INTERVAL '7 days')
       OR expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
