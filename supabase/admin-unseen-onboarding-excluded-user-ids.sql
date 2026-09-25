-- User ids to drop from the admin "App onboarding incomplete" list.
-- SECURITY DEFINER so service_role can read auth.users. EXECUTE is service_role only.

CREATE OR REPLACE FUNCTION public.admin_unseen_onboarding_excluded_user_ids(p_user_ids uuid[])
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT u.id
  FROM auth.users u
  WHERE u.id = ANY (p_user_ids)
    AND (
      (
        (u.raw_user_meta_data ->> 'provisioned_offline') = 'true'
        AND u.last_sign_in_at IS NULL
      )
      OR u.banned_until > pg_catalog.now()
    );
END;
$$;

COMMENT ON FUNCTION public.admin_unseen_onboarding_excluded_user_ids(uuid[]) IS
  'Service-role lookup of auth users to exclude from incomplete app onboarding: never-signed-in offline provisions, and accounts banned past now().';

REVOKE ALL ON FUNCTION public.admin_unseen_onboarding_excluded_user_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unseen_onboarding_excluded_user_ids(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unseen_onboarding_excluded_user_ids(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
