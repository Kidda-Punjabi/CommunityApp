-- Fix: tutor calendar RPCs must use profile_roles (not legacy is_tutor() / profiles.app_role).
-- Run in Supabase SQL Editor if get_tutor_calendar_connection_status returns "Tutor access required".

CREATE OR REPLACE FUNCTION public.user_can_access_tutor_dashboard(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    WHERE pr.user_id = p_user_id
      AND pr.role IN ('tutor'::public.app_role, 'master_admin'::public.app_role)
  )
  OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_tutor_calendar_connection_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.tutor_google_calendar_connections%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_tutor_dashboard(v_user) THEN
    RAISE EXCEPTION 'Tutor access required';
  END IF;

  SELECT * INTO v_row
  FROM public.tutor_google_calendar_connections
  WHERE tutor_id = v_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'google_account_email', v_row.google_account_email,
    'calendar_id', v_row.calendar_id,
    'connected_at', v_row.connected_at,
    'last_synced_at', v_row.last_synced_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_tutor_google_calendar()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_tutor_dashboard(v_user) THEN
    RAISE EXCEPTION 'Tutor access required';
  END IF;

  DELETE FROM public.tutor_google_calendar_connections WHERE tutor_id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_tutor_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_calendar_connection_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_tutor_google_calendar() TO authenticated;

NOTIFY pgrst, 'reload schema';
