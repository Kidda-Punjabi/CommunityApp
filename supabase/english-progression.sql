-- =============================================================================
-- Kidda — English learner XP (separate from Punjabi profiles.total_xp)
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS english_total_xp INTEGER NOT NULL DEFAULT 0
    CHECK (english_total_xp >= 0);

COMMENT ON COLUMN public.profiles.english_total_xp IS
  'Lifetime English XP — separate from Punjabi total_xp. Never decreases.';

-- One-time English lesson-completion XP awards (mirrors weekly_lesson_points_awarded)
CREATE TABLE IF NOT EXISTS public.english_lesson_xp_awarded (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_english_lesson_xp_awarded_lesson
  ON public.english_lesson_xp_awarded (lesson_id);

COMMENT ON TABLE public.english_lesson_xp_awarded IS
  'Idempotent English lesson-completion XP grants. Does not write Punjabi weekly_points.';

ALTER TABLE public.english_lesson_xp_awarded ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own english lesson xp awards"
  ON public.english_lesson_xp_awarded;
CREATE POLICY "Users can read own english lesson xp awards"
  ON public.english_lesson_xp_awarded
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Award English lifetime XP (monotonic)
CREATE OR REPLACE FUNCTION public.award_english_xp(p_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_total INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_xp IS NULL OR p_xp <= 0 OR p_xp > 100 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  UPDATE public.profiles
  SET english_total_xp = english_total_xp + p_xp
  WHERE id = v_user_id
  RETURNING english_total_xp INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- Award English lesson-completion XP once when fully complete
CREATE OR REPLACE FUNCTION public.try_award_english_lesson_completion_xp(
  p_lesson_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status RECORD;
  v_awarded_user UUID;
  v_track TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.content_track
  INTO v_track
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = p_lesson_id;

  IF v_track IS DISTINCT FROM 'learn_english' THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_status
  FROM public.get_lesson_completion_status(v_user_id, p_lesson_id)
  LIMIT 1;

  IF v_status IS NULL OR NOT v_status.fully_complete THEN
    RETURN false;
  END IF;

  INSERT INTO public.english_lesson_xp_awarded (user_id, lesson_id)
  VALUES (v_user_id, p_lesson_id)
  ON CONFLICT DO NOTHING
  RETURNING user_id INTO v_awarded_user;

  IF v_awarded_user IS NOT NULL THEN
    PERFORM public.award_english_xp(25);
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_english_xp(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_award_english_lesson_completion_xp(UUID) TO authenticated;
