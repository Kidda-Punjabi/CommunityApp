-- =============================================================================
-- Kidda — Per-course access (replaces tier-based profile_course_access)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.course_access (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_access_user_id ON public.course_access (user_id);
CREATE INDEX IF NOT EXISTS idx_course_access_course_id ON public.course_access (course_id);

ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own course access" ON public.course_access;
CREATE POLICY "Users can read own course access"
  ON public.course_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.course_access TO authenticated;
GRANT ALL ON public.course_access TO service_role;

-- Migrate existing tier-based rows into course_access (matches courses.required_tier)
INSERT INTO public.course_access (user_id, course_id, granted_at)
SELECT pca.user_id, c.id, pca.granted_at
FROM public.profile_course_access pca
JOIN public.courses c ON c.required_tier = pca.course_tier
ON CONFLICT (user_id, course_id) DO NOTHING;

-- Legacy single-tier profiles → course_access
INSERT INTO public.course_access (user_id, course_id, granted_at)
SELECT p.id, c.id, now()
FROM public.profiles p
JOIN public.courses c ON c.required_tier = p.membership_tier
WHERE p.membership_tier IN ('foundational', 'beginners', 'community')
ON CONFLICT (user_id, course_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
