-- =============================================================================
-- Kidda — Make is_tutor() honour profile_roles + keep app_role in sync
--
-- Problem: tutors granted via profile_roles but left as profiles.app_role =
-- 'member' fail every is_tutor()-gated RLS policy (empty reads / insert denied).
--
-- Fix:
--   1. is_tutor() is additive: existing app_role / is_admin() checks OR a
--      profile_roles row with role = 'tutor'.
--   2. AFTER INSERT on profile_roles (role = 'tutor') promotes
--      profiles.app_role from 'member' → 'tutor' (no auto-downgrade on delete).
--
-- Leaves is_master_admin() / is_admin() / profile_roles schema unchanged.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN (
           'tutor'::public.app_role,
           'master_admin'::public.app_role
         )
      OR public.is_admin()
      OR EXISTS (
           SELECT 1
           FROM public.profile_roles pr
           WHERE pr.user_id = auth.uid()
             AND pr.role = 'tutor'::public.app_role
         );
$$;

COMMENT ON FUNCTION public.is_tutor() IS
  'True when profiles.app_role is tutor/master_admin, is_admin(), or profile_roles has role = tutor.';

CREATE OR REPLACE FUNCTION public.sync_app_role_on_tutor_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only promote plain members. Never overwrite master_admin / community_lead / tutor.
  UPDATE public.profiles
  SET app_role = 'tutor'::public.app_role,
      updated_at = now()
  WHERE id = NEW.user_id
    AND app_role = 'member'::public.app_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_app_role_on_tutor_profile_role ON public.profile_roles;
CREATE TRIGGER trg_sync_app_role_on_tutor_profile_role
  AFTER INSERT ON public.profile_roles
  FOR EACH ROW
  WHEN (NEW.role = 'tutor'::public.app_role)
  EXECUTE FUNCTION public.sync_app_role_on_tutor_profile_role();

COMMENT ON FUNCTION public.sync_app_role_on_tutor_profile_role() IS
  'When a tutor row is inserted into profile_roles, promote profiles.app_role member → tutor. No downgrade on delete.';

GRANT EXECUTE ON FUNCTION public.is_tutor() TO authenticated;

NOTIFY pgrst, 'reload schema';
