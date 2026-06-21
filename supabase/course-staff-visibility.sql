-- Allow members to see who holds the community_lead role (for Learn → Community page)
-- Run after profile-roles.sql

DROP POLICY IF EXISTS "Authenticated read community lead roles" ON public.profile_roles;
CREATE POLICY "Authenticated read community lead roles"
  ON public.profile_roles FOR SELECT TO authenticated
  USING (role = 'community_lead'::public.app_role);

NOTIFY pgrst, 'reload schema';
