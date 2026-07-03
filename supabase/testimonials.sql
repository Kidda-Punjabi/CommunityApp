-- =============================================================================
-- Kidda — Featured testimonials for Community tab
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote TEXT NOT NULL,
  author_name TEXT NOT NULL,
  context_line TEXT NOT NULL,
  featured_week DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_featured_week
  ON public.testimonials (featured_week)
  WHERE is_active = true;

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active testimonials" ON public.testimonials;
CREATE POLICY "Authenticated read active testimonials"
  ON public.testimonials FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
CREATE POLICY "Admins manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.testimonials (quote, author_name, context_line, is_active)
SELECT
  'Learning with Kidda has meant I can finally speak to my nani in her own language. It''s changed how close we feel.',
  'Simran',
  'Level 2 · learning since March',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.testimonials);
