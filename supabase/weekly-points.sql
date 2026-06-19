-- =============================================================================
-- Kidda — Weekly leaderboard points
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_points_week_start_points
  ON public.weekly_points (week_start, points DESC);

-- One-time lesson completion bonus per user per lesson (lifetime)
CREATE TABLE IF NOT EXISTS public.weekly_lesson_points_awarded (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

COMMENT ON TABLE public.weekly_points IS
  'Weekly activity points for the community leaderboard (resets by week_start).';
COMMENT ON TABLE public.weekly_lesson_points_awarded IS
  'Tracks lesson-completion point bonuses already granted (25 pts once per lesson).';

-- Monday of the calendar week containing d (weeks run Mon–Sun)
CREATE OR REPLACE FUNCTION public.week_start_monday(d DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT d - ((EXTRACT(DOW FROM d)::INTEGER + 6) % 7);
$$;

CREATE OR REPLACE FUNCTION public.current_week_start_monday()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT public.week_start_monday(CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION public.award_weekly_points(
  p_points INTEGER,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_week_start DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_points IS NULL OR p_points <= 0 OR p_points > 50 THEN
    RAISE EXCEPTION 'Invalid points amount';
  END IF;

  v_week_start := public.week_start_monday(p_activity_date);

  IF v_week_start > public.current_week_start_monday() THEN
    RAISE EXCEPTION 'Cannot award points for a future week';
  END IF;

  INSERT INTO public.weekly_points (user_id, week_start, points)
  VALUES (v_user_id, v_week_start, p_points)
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    points = public.weekly_points.points + EXCLUDED.points,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.try_award_lesson_completion_points(
  p_lesson_id UUID,
  p_activity_date DATE DEFAULT CURRENT_DATE
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_status
  FROM public.get_lesson_completion_status(v_user_id, p_lesson_id)
  LIMIT 1;

  IF v_status IS NULL OR NOT v_status.fully_complete THEN
    RETURN false;
  END IF;

  INSERT INTO public.weekly_lesson_points_awarded (user_id, lesson_id)
  VALUES (v_user_id, p_lesson_id)
  ON CONFLICT DO NOTHING
  RETURNING user_id INTO v_awarded_user;

  IF v_awarded_user IS NOT NULL THEN
    PERFORM public.award_weekly_points(25, p_activity_date);
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.week_start_monday(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_week_start_monday() TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_weekly_points(INTEGER, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_award_lesson_completion_points(UUID, DATE) TO authenticated;

ALTER TABLE public.weekly_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_lesson_points_awarded ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read weekly points" ON public.weekly_points;
CREATE POLICY "Authenticated users can read weekly points"
  ON public.weekly_points FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own lesson point awards" ON public.weekly_lesson_points_awarded;
CREATE POLICY "Users can read own lesson point awards"
  ON public.weekly_lesson_points_awarded FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.weekly_points TO authenticated;
GRANT SELECT ON public.weekly_lesson_points_awarded TO authenticated;

-- Leaderboard needs display names/avatars for other members
DROP POLICY IF EXISTS "Authenticated users can read profiles for leaderboard" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles for leaderboard"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Optional seed: assign sample weekly points to up to 8 existing profiles
-- (uses real accounts already in the DB — safe to re-run for current week)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_week DATE := public.current_week_start_monday();
  v_points INTEGER[] := ARRAY[312, 245, 198, 156, 134, 98, 67, 41];
  v_profile RECORD;
  v_i INTEGER := 1;
BEGIN
  FOR v_profile IN
    SELECT id FROM public.profiles ORDER BY created_at LIMIT 8
  LOOP
    INSERT INTO public.weekly_points (user_id, week_start, points)
    VALUES (v_profile.id, v_week, v_points[v_i])
    ON CONFLICT (user_id, week_start)
    DO UPDATE SET
      points = GREATEST(public.weekly_points.points, EXCLUDED.points),
      updated_at = now();

    v_i := v_i + 1;
    EXIT WHEN v_i > array_length(v_points, 1);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
