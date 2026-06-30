-- Admin saved table views (filter/group/sort configs). Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.admin_saved_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  view_type  text NOT NULL,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_saved_views_type
  ON public.admin_saved_views (view_type, created_at DESC);

COMMENT ON TABLE public.admin_saved_views IS
  'Named admin table configurations (filters, grouping, sort). view_type scopes usage, e.g. packages.';

ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read saved views" ON public.admin_saved_views;
CREATE POLICY "Admins read saved views"
  ON public.admin_saved_views FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Admins create saved views" ON public.admin_saved_views;
CREATE POLICY "Admins create saved views"
  ON public.admin_saved_views FOR INSERT TO authenticated
  WITH CHECK (public.is_community_lead() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins update saved views" ON public.admin_saved_views;
CREATE POLICY "Admins update saved views"
  ON public.admin_saved_views FOR UPDATE TO authenticated
  USING (
    public.is_community_lead()
    AND (created_by = auth.uid() OR public.is_master_admin())
  )
  WITH CHECK (
    public.is_community_lead()
    AND (created_by = auth.uid() OR public.is_master_admin())
  );

DROP POLICY IF EXISTS "Admins delete saved views" ON public.admin_saved_views;
CREATE POLICY "Admins delete saved views"
  ON public.admin_saved_views FOR DELETE TO authenticated
  USING (
    public.is_community_lead()
    AND (created_by = auth.uid() OR public.is_master_admin())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_saved_views TO authenticated;

NOTIFY pgrst, 'reload schema';
