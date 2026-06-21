-- =============================================================================
-- Kidda — Multi-role staff (tutor + community_lead + master_admin per user)
-- Run in Supabase SQL Editor after tutor-cohort-access.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_roles (
  user_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role      public.app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role),
  CONSTRAINT profile_roles_no_member CHECK (role <> 'member'::public.app_role)
);

CREATE INDEX IF NOT EXISTS idx_profile_roles_user_id ON public.profile_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_roles_role ON public.profile_roles (role);

COMMENT ON TABLE public.profile_roles IS
  'Staff roles per user. A user may hold multiple roles. Absence of rows = member.';

-- Migrate single app_role column when present
INSERT INTO public.profile_roles (user_id, role)
SELECT p.id, p.app_role
FROM public.profiles p
WHERE p.app_role IS NOT NULL
  AND p.app_role <> 'member'::public.app_role
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role helpers (profile_roles is source of truth)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_app_role(
  p_user_id UUID,
  p_role public.app_role
)
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
      AND pr.role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_app_role(auth.uid(), 'master_admin'::public.app_role)
     OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_community_lead()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_app_role(auth.uid(), 'community_lead'::public.app_role)
      OR public.user_has_app_role(auth.uid(), 'master_admin'::public.app_role)
      OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_app_role(auth.uid(), 'tutor'::public.app_role)
      OR public.user_has_app_role(auth.uid(), 'master_admin'::public.app_role)
      OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.user_has_any_staff_role(
  p_user_id UUID,
  p_roles public.app_role[]
)
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
      AND pr.role = ANY (p_roles)
  );
$$;

-- Replace single-role setter with multi-role sync
DROP FUNCTION IF EXISTS public.set_user_app_role(UUID, public.app_role);

CREATE OR REPLACE FUNCTION public.set_user_app_roles(
  p_user_id UUID,
  p_roles public.app_role[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Only master admins can assign roles.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Profile not found for user %.', p_user_id;
  END IF;

  DELETE FROM public.profile_roles WHERE user_id = p_user_id;

  IF p_roles IS NULL OR array_length(p_roles, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_role IN ARRAY p_roles LOOP
    IF v_role = 'member'::public.app_role THEN
      CONTINUE;
    END IF;
    INSERT INTO public.profile_roles (user_id, role)
    VALUES (p_user_id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_app_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_any_staff_role(UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_app_roles(UUID, public.app_role[]) TO authenticated;

ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile roles" ON public.profile_roles;
CREATE POLICY "Users read own profile roles"
  ON public.profile_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master_admin() OR public.is_staff());

DROP POLICY IF EXISTS "Master admin manage profile roles" ON public.profile_roles;
CREATE POLICY "Master admin manage profile roles"
  ON public.profile_roles FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_roles TO authenticated;

NOTIFY pgrst, 'reload schema';
