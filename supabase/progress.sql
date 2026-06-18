-- =============================================================================
-- Kidda — Progress tracking (lessons, quizzes, flashcards, streaks)
-- Run in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lesson_progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  seconds_listened INTEGER NOT NULL DEFAULT 0,
  last_position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id
  ON public.lesson_progress (user_id);

-- -----------------------------------------------------------------------------
-- quiz_progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes (id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER,
  last_attempted_at TIMESTAMPTZ,
  UNIQUE (user_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_progress_user_id
  ON public.quiz_progress (user_id);

-- -----------------------------------------------------------------------------
-- flashcard_progress
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards (id) ON DELETE CASCADE,
  confidence TEXT NOT NULL DEFAULT 'not_confident'
    CHECK (confidence IN ('not_confident', 'confident')),
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE (user_id, flashcard_id)
);

CREATE INDEX IF NOT EXISTS idx_flashcard_progress_user_id
  ON public.flashcard_progress (user_id);

-- -----------------------------------------------------------------------------
-- user_streaks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE
);

-- -----------------------------------------------------------------------------
-- Auto-update lesson_progress.updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_lesson_progress_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lesson_progress_updated_at();

-- -----------------------------------------------------------------------------
-- update_user_streak
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_date DATE;
  v_current INTEGER;
  v_longest INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_current, v_longest
  FROM public.user_streaks
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, v_today);
    RETURN;
  END IF;

  IF v_last_date = v_today THEN
    RETURN;
  ELSIF v_last_date = v_today - 1 THEN
    v_current := v_current + 1;
  ELSE
    v_current := 1;
  END IF;

  IF v_current > v_longest THEN
    v_longest := v_current;
  END IF;

  UPDATE public.user_streaks
  SET
    current_streak = v_current,
    longest_streak = v_longest,
    last_activity_date = v_today
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_streak(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users manage own lesson progress"
  ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own quiz progress" ON public.quiz_progress;
CREATE POLICY "Users manage own quiz progress"
  ON public.quiz_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own flashcard progress" ON public.flashcard_progress;
CREATE POLICY "Users manage own flashcard progress"
  ON public.flashcard_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own streaks" ON public.user_streaks;
CREATE POLICY "Users manage own streaks"
  ON public.user_streaks FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_streaks TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
GRANT ALL ON public.quiz_progress TO service_role;
GRANT ALL ON public.flashcard_progress TO service_role;
GRANT ALL ON public.user_streaks TO service_role;

NOTIFY pgrst, 'reload schema';
