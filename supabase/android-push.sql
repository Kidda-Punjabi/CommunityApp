-- Android push tokens and the platform recorded on each send.
-- The existing 3-argument register function stays, so current iOS clients still store platform ios.

ALTER TABLE public.push_send_log
  ADD COLUMN IF NOT EXISTS platform text;

CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_token text,
  p_timezone text,
  p_app_version text,
  p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_platform text := CASE
    WHEN lower(btrim(COALESCE(p_platform, ''))) = 'android' THEN 'android'
    ELSE 'ios'
  END;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  INSERT INTO public.device_push_tokens (
    user_id, token, platform, app_version, timezone, last_seen_at
  )
  VALUES (
    v_user,
    btrim(p_token),
    v_platform,
    NULLIF(btrim(COALESCE(p_app_version, '')), ''),
    NULLIF(btrim(COALESCE(p_timezone, '')), ''),
    now()
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    app_version = EXCLUDED.app_version,
    timezone = COALESCE(EXCLUDED.timezone, public.device_push_tokens.timezone),
    last_seen_at = now(),
    disabled_at = NULL;

  UPDATE public.profiles
  SET timezone = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), timezone)
  WHERE id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
