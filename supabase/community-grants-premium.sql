-- Community members get everything Premium unlocks (decision 29 Oct 2026).
-- One way only: Premium never grants Community.
-- App side: loadPremiumAccess() in src/lib/membership/premium-access.ts.

CREATE OR REPLACE FUNCTION public._user_has_confirmed_community(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_packages sp
    WHERE sp.user_id = p_user_id
      AND sp.course_id = '22f0e217-92a7-46f0-b38e-651409d7d118'
      AND sp.status = 'confirmed'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_tier_access(allowed_tiers membership_tier[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.membership_tier = ANY (allowed_tiers)
  )
  OR (
    'premium'::membership_tier = ANY (allowed_tiers)
    AND public._user_has_confirmed_community(auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.tier_name <> 'free'
  )
  OR public._user_has_confirmed_community(auth.uid());
$$;

REVOKE ALL ON FUNCTION public._user_has_confirmed_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._user_has_confirmed_community(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
