-- Cierra funciones SECURITY DEFINER heredadas que Postgres deja ejecutables
-- por PUBLIC al crearlas si no se revocan permisos explícitamente.

CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_business_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión para aceptar una invitación.';
  END IF;

  SELECT id, business_id, role
    INTO v_member_id, v_business_id, v_role
    FROM public.team_members
   WHERE invite_token = p_token AND user_id IS NULL
   FOR UPDATE;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Enlace de invitación inválido o ya utilizado.';
  END IF;

  UPDATE public.team_members
     SET user_id = auth.uid(), invite_accepted = true, invite_token = NULL
   WHERE id = v_member_id;

  INSERT INTO public.profiles (id, email, full_name, role, business_id)
  VALUES (auth.uid(), auth.jwt()->>'email', '', v_role, v_business_id)
  ON CONFLICT (id) DO UPDATE SET role = v_role, business_id = v_business_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cleanup_expired_cancel_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cancel_tokens() TO service_role;

REVOKE ALL ON FUNCTION public.increment_coupon_uses(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_uses(UUID) TO service_role;

-- Estas cuatro se ejecutan únicamente desde triggers. El dueño de la función
-- conserva permiso implícito; los roles del navegador no deben invocarlas.
REVOKE ALL ON FUNCTION public.log_profile_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_visits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_client_visits_on_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_business_rating() FROM PUBLIC, anon, authenticated;
