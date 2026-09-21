-- Cierra objetos antiguos expuestos por los grants amplios de Supabase.
-- La aplicación accede a estas tablas mediante APIs de servidor con controles
-- de autorización, por lo que los roles del navegador no necesitan acceso.

ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.working_hours FROM anon, authenticated;
REVOKE ALL ON TABLE public.blocked_times FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_programs FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_points FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_transactions FROM anon, authenticated;

-- Esta vista no tiene consumidores en la aplicación actual y, por ser simple
-- y SECURITY DEFINER, además era actualizable sobre team_members.
DROP VIEW IF EXISTS public.public_team_members;

-- Fijar search_path evita que un objeto con el mismo nombre en otro esquema
-- sea resuelto por una función privilegiada.
ALTER FUNCTION public.update_business_rating() SET search_path = public;
ALTER FUNCTION public.sync_client_visits(UUID) SET search_path = public;
ALTER FUNCTION public.trg_sync_client_visits_on_appointment() SET search_path = public;
ALTER FUNCTION public.check_max_locations_limit() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_cancel_tokens() SET search_path = public;
ALTER FUNCTION public.increment_coupon_uses(UUID) SET search_path = public;
ALTER FUNCTION public.auto_approve_users() SET search_path = public;
ALTER FUNCTION public.log_profile_role_change() SET search_path = public;

-- Los objetos nuevos nacen cerrados. Cada migración debe conceder solamente
-- los permisos públicos que requiera explícitamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
