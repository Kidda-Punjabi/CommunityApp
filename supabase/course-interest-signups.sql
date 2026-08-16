-- Coming-soon course interest (Intermediate / Advanced).
-- Members register from Learn; admins read the list under People.

CREATE TABLE IF NOT EXISTS public.course_interest_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_level  TEXT NOT NULL
    CHECK (course_level IN ('intermediate', 'advanced')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_level)
);

COMMENT ON TABLE public.course_interest_signups IS
  'Waitlist for coming-soon Learn courses (Intermediate, Advanced).';

CREATE INDEX IF NOT EXISTS idx_course_interest_signups_level
  ON public.course_interest_signups (course_level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_interest_signups_user
  ON public.course_interest_signups (user_id);

ALTER TABLE public.course_interest_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own course interest" ON public.course_interest_signups;
CREATE POLICY "Users read own course interest"
  ON public.course_interest_signups
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own course interest" ON public.course_interest_signups;
CREATE POLICY "Users insert own course interest"
  ON public.course_interest_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read course interest" ON public.course_interest_signups;
CREATE POLICY "Admins read course interest"
  ON public.course_interest_signups
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin());

GRANT SELECT, INSERT ON public.course_interest_signups TO authenticated;

NOTIFY pgrst, 'reload schema';
