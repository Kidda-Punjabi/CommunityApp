-- =============================================================================
-- Kidda — Forum exclusion when any kid profile is active (all age tiers)
-- Run after kids-mode.sql and forum.sql
-- =============================================================================

-- Block forum access when a kid profile session is active
CREATE OR REPLACE FUNCTION public.user_can_access_forum(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.user_has_active_kid_profile()
    AND (
      EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.user_id = p_user_id
          AND m.status = 'active'::public.subscription_status
      )
      OR public.user_has_any_staff_role(
        p_user_id,
        ARRAY[
          'tutor'::public.app_role,
          'community_lead'::public.app_role,
          'master_admin'::public.app_role
        ]
      )
    );
$$;

NOTIFY pgrst, 'reload schema';
