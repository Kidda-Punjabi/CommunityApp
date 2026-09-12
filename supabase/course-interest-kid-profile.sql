-- Allow kid-profile interest signups (XOR with adult user_id).
-- Live course_level values were only intermediate/advanced; kids use
-- kids_intermediate / kids_advanced so adult reporting stays separate.

ALTER TABLE public.course_interest_signups
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.course_interest_signups
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.course_interest_signups
  DROP CONSTRAINT IF EXISTS course_interest_signups_course_level_check;

ALTER TABLE public.course_interest_signups
  ADD CONSTRAINT course_interest_signups_course_level_check
  CHECK (course_level = ANY (ARRAY[
    'intermediate'::text,
    'advanced'::text,
    'kids_intermediate'::text,
    'kids_advanced'::text
  ]));

ALTER TABLE public.course_interest_signups
  DROP CONSTRAINT IF EXISTS course_interest_signups_user_id_course_level_key;

CREATE UNIQUE INDEX IF NOT EXISTS course_interest_signups_user_level_uidx
  ON public.course_interest_signups (user_id, course_level)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS course_interest_signups_kid_level_uidx
  ON public.course_interest_signups (kid_profile_id, course_level)
  WHERE kid_profile_id IS NOT NULL;

ALTER TABLE public.course_interest_signups
  DROP CONSTRAINT IF EXISTS course_interest_signups_actor_xor;

ALTER TABLE public.course_interest_signups
  ADD CONSTRAINT course_interest_signups_actor_xor
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_course_interest_signups_kid
  ON public.course_interest_signups (kid_profile_id);

DROP POLICY IF EXISTS "Users insert own course interest" ON public.course_interest_signups;
CREATE POLICY "Users insert own course interest" ON public.course_interest_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      user_id = (select auth.uid())
      AND kid_profile_id IS NULL
    )
    OR (
      user_id IS NULL
      AND public.parent_owns_kid_profile(kid_profile_id)
    )
  );

DROP POLICY IF EXISTS "Users read own course interest" ON public.course_interest_signups;
CREATE POLICY "Users read own course interest" ON public.course_interest_signups
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  );
