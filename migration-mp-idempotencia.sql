-- Idempotencia de pagos de Mercado Pago.
--
-- El webhook seteaba plan_expires_at = hoy + 30 en CADA notificación aprobada.
-- Mercado Pago reenvía notificaciones por diseño (reintentos), así que el mismo
-- pago se aplicaba varias veces; y quien capturara una notificación válida podía
-- reenviarla para renovar el plan indefinidamente.
--
-- El INSERT con constraint único es el candado: si el pago ya se aplicó, la
-- inserción falla con 23505 y el webhook sabe que no tiene que volver a tocar
-- la suscripción. Mismo patrón que cancel_tokens.

CREATE TABLE IF NOT EXISTS mp_pagos_aplicados (
    payment_id   TEXT PRIMARY KEY,
    business_id  UUID REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id      TEXT,
    aplicado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_pagos_aplicados_business_idx
    ON mp_pagos_aplicados (business_id, aplicado_en DESC);

-- Solo el service_role toca esta tabla: es el webhook, nunca el navegador.
-- RLS activo SIN políticas = bloquea a anon y authenticated por completo.
ALTER TABLE mp_pagos_aplicados ENABLE ROW LEVEL SECURITY;

-- El grant amplio de Supabase (GRANT ALL ON ALL TABLES TO anon, authenticated)
-- alcanza a las tablas nuevas, así que no alcanza con RLS: hay que sacarlo.
REVOKE ALL ON mp_pagos_aplicados FROM anon, authenticated;

-- Y corregir el default, o cada objeto creado después vuelve a nacer abierto.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Verificación: ambas consultas tienen que devolver 0 filas.
--   SELECT * FROM information_schema.table_privileges
--    WHERE table_name = 'mp_pagos_aplicados' AND grantee IN ('anon','authenticated');
