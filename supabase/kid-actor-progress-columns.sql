-- Kid-owned practice / flashcard / feedback progress.
-- Same XOR actor pattern as lesson_progress: exactly one of user_id / kid_profile_id.

-- topic_mastery (Everyday Punjabi Practise)
ALTER TABLE public.topic_mastery
  ADD COLUMN IF NOT EXISTS kid_profile_id UUID REFERENCES public.kid_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.topic_mastery
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_user_id_lesson_id_key;

DROP INDEX IF EXISTS public.topic_mastery_user_lesson_key;
DROP INDEX IF EXISTS public.topic_mastery_kid_lesson_key;

ALTER TABLE public.topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_kid_lesson_key;

ALTER TABLE public.topic_mastery
  ADD CONSTRAINT topic_mastery_user_id_lesson_id_key UNIQUE (user_id, lesson_id);

ALTER TABLE public.topic_mastery
  ADD CONSTRAINT topic_mastery_kid_lesson_key UNIQUE (kid_profile_id, lesson_id);

ALTER TABLE public.topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_actor_check;

ALTER TABLE public.topic_mastery
  ADD CONSTRAINT topic_mastery_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

DROP POLICY IF EXISTS "Users manage own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users manage own topic mastery"
  ON public.topic_mastery
  FOR ALL
  USING (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

-- flashcard_progress
ALTER TABLE public.flashcard_progress
  ADD COLUMN IF NOT EXISTS kid_profile_id UUID REFERENCES public.kid_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.flashcard_progress
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.flashcard_progress
  DROP CONSTRAINT IF EXISTS flashcard_progress_user_id_flashcard_id_key;

DROP INDEX IF EXISTS public.flashcard_progress_user_flashcard_key;
DROP INDEX IF EXISTS public.flashcard_progress_kid_flashcard_key;

ALTER TABLE public.flashcard_progress
  DROP CONSTRAINT IF EXISTS flashcard_progress_kid_flashcard_key;

ALTER TABLE public.flashcard_progress
  ADD CONSTRAINT flashcard_progress_user_id_flashcard_id_key UNIQUE (user_id, flashcard_id);

ALTER TABLE public.flashcard_progress
  ADD CONSTRAINT flashcard_progress_kid_flashcard_key UNIQUE (kid_profile_id, flashcard_id);

ALTER TABLE public.flashcard_progress
  DROP CONSTRAINT IF EXISTS flashcard_progress_actor_check;

ALTER TABLE public.flashcard_progress
  ADD CONSTRAINT flashcard_progress_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

DROP POLICY IF EXISTS "Users manage own flashcard progress" ON public.flashcard_progress;
CREATE POLICY "Users manage own flashcard progress"
  ON public.flashcard_progress
  FOR ALL
  USING (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

-- feedback_submissions (user_id already nullable for guests)
ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS kid_profile_id UUID REFERENCES public.kid_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_actor_check;

ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_actor_check
  CHECK (NOT (user_id IS NOT NULL AND kid_profile_id IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS feedback_submissions_kid_session_unique
  ON public.feedback_submissions (kid_profile_id, session_id)
  WHERE kid_profile_id IS NOT NULL AND session_id IS NOT NULL;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback_submissions;
DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback_submissions;
DROP POLICY IF EXISTS "Users update own feedback sync" ON public.feedback_submissions;

CREATE POLICY "Users insert own feedback"
  ON public.feedback_submissions
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
    OR (is_guest = true AND user_id IS NULL AND kid_profile_id IS NULL)
  );

CREATE POLICY "Users read own feedback"
  ON public.feedback_submissions
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

CREATE POLICY "Users update own feedback sync"
  ON public.feedback_submissions
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.parent_owns_kid_profile(kid_profile_id)
  );
