-- =============================================================================
-- Kidda — Site branding (logo, icon, favicon)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.site_branding (
  id           TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  logo_url     TEXT,
  icon_url     TEXT,
  favicon_url  TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_branding (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site branding" ON public.site_branding;
CREATE POLICY "Anyone can read site branding"
  ON public.site_branding FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can manage site branding" ON public.site_branding;
CREATE POLICY "Staff can manage site branding"
  ON public.site_branding FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin())
  WITH CHECK (public.is_admin() OR public.is_master_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket for logo / icon / favicon assets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-branding', 'site-branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view site branding assets" ON storage.objects;
CREATE POLICY "Anyone can view site branding assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'site-branding');

DROP POLICY IF EXISTS "Staff can upload site branding assets" ON storage.objects;
CREATE POLICY "Staff can upload site branding assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-branding' AND (public.is_admin() OR public.is_master_admin()));

DROP POLICY IF EXISTS "Staff can update site branding assets" ON storage.objects;
CREATE POLICY "Staff can update site branding assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-branding' AND (public.is_admin() OR public.is_master_admin()))
  WITH CHECK (bucket_id = 'site-branding' AND (public.is_admin() OR public.is_master_admin()));

DROP POLICY IF EXISTS "Staff can delete site branding assets" ON storage.objects;
CREATE POLICY "Staff can delete site branding assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-branding' AND (public.is_admin() OR public.is_master_admin()));
