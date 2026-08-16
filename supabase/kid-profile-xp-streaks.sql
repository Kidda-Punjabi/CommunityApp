-- =============================================================================
-- Kidda — Per-kid XP and streaks (independent of parent profiles.total_xp)
-- Run in Supabase SQL Editor after kids-mode.sql / streaks.sql / learner-progression.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- kid_profiles.total_xp
-- ---------------------------------------------------------------------------

ALTER TABLE public.kid_profiles
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0
    CHECK (total_xp >= 0);

COMMENT ON COLUMN public.kid_profiles.total_xp IS
  'Lifetime Punjabi XP for this kid profile. Independent of parent profiles.total_xp.';

-- One-time lesson-completion XP per kid (do not reuse weekly_lesson_points_awarded,
-- which is keyed by parent user_id and would steal the parent's bonus).
CREATE TABLE IF NOT EXISTS public.kid_lesson_xp_awarded (
  kid_profile_id UUID NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kid_profile_id, lesson_id)
);

COMMENT ON TABLE public.kid_lesson_xp_awarded IS
  'Tracks the 25 XP lesson-completion bonus already granted per kid profile.';

ALTER TABLE public.kid_lesson_xp_awarded ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents read kid lesson xp awards" ON public.kid_lesson_xp_awarded;
CREATE POLICY "Parents read kid lesson xp awards"
  ON public.kid_lesson_xp_awarded FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents insert kid lesson xp awards" ON public.kid_lesson_xp_awarded;
CREATE POLICY "Parents insert kid lesson xp awards"
  ON public.kid_lesson_xp_awarded FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.kid_lesson_xp_awarded TO authenticated;
GRANT ALL ON public.kid_lesson_xp_awarded TO service_role;

-- ---------------------------------------------------------------------------
-- user_streaks.kid_profile_id
-- Adult rows keep kid_profile_id NULL. Each (user_id, kid) pair has its own row.
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_streaks
  ADD COLUMN IF NOT EXISTS kid_profile_id UUID REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.user_streaks.kid_profile_id IS
  'NULL = parent/adult streak for user_id. Set = streak for that kid profile under the parent account.';

ALTER TABLE public.user_streaks
  DROP CONSTRAINT IF EXISTS user_streaks_user_id_key;

DROP INDEX IF EXISTS user_streaks_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_streaks_adult_user_id_key
  ON public.user_streaks (user_id)
  WHERE kid_profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_streaks_kid_user_id_key
  ON public.user_streaks (user_id, kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_streaks_kid_profile_id
  ON public.user_streaks (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- evaluate_user_streak — honour active kid_session_context
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.evaluate_user_streak(
  p_user_id UUID,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_streaks%ROWTYPE;
  v_kid_id UUID;
  v_gap INTEGER;
  v_redemption_expired BOOLEAN := false;
  v_at_risk BOOLEAN := false;
  v_display INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_kid_id := public.active_kid_profile_id_for(p_user_id);

  SELECT * INTO v_row
  FROM public.user_streaks
  WHERE user_id = p_user_id
    AND kid_profile_id IS NOT DISTINCT FROM v_kid_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'display_streak', 0,
      'longest_streak', 0,
      'redemption_available', false,
      'streak_at_risk', false,
      'streak_before_break', NULL,
      'streak_rescued', false,
      'redemption_expired', false,
      'already_active_today', false
    );
  END IF;

  IF v_row.redemption_available
    AND v_row.streak_broken_date IS NOT NULL
    AND p_today > v_row.streak_broken_date THEN
    UPDATE public.user_streaks
    SET
      longest_streak = GREATEST(longest_streak, COALESCE(streak_before_break, current_streak)),
      current_streak = 0,
      redemption_available = false,
      streak_broken_date = NULL,
      streak_before_break = NULL,
      redeemed_today = false
    WHERE user_id = p_user_id
      AND kid_profile_id IS NOT DISTINCT FROM v_kid_id
    RETURNING * INTO v_row;

    v_redemption_expired := true;
  END IF;

  IF v_row.last_activity_date IS NOT NULL THEN
    v_gap := p_today - v_row.last_activity_date;

    IF NOT v_row.redemption_available THEN
      IF v_gap >= 3 THEN
        UPDATE public.user_streaks
        SET
          longest_streak = GREATEST(longest_streak, current_streak),
          current_streak = 0,
          streak_before_break = NULL,
          streak_broken_date = NULL,
          redeemed_today = false
        WHERE user_id = p_user_id
          AND kid_profile_id IS NOT DISTINCT FROM v_kid_id
        RETURNING * INTO v_row;
      ELSIF v_gap = 2 THEN
        UPDATE public.user_streaks
        SET
          redemption_available = true,
          streak_broken_date = p_today,
          streak_before_break = GREATEST(
            COALESCE(streak_before_break, 0),
            current_streak
          ),
          redeemed_today = false
        WHERE user_id = p_user_id
          AND kid_profile_id IS NOT DISTINCT FROM v_kid_id
        RETURNING * INTO v_row;
      END IF;
    END IF;

    v_gap := p_today - v_row.last_activity_date;
    v_at_risk := v_gap = 1 AND NOT v_row.redemption_available;
  END IF;

  IF v_row.last_activity_date IS NOT NULL AND v_row.last_activity_date < p_today THEN
    UPDATE public.user_streaks
    SET redeemed_today = false
    WHERE user_id = p_user_id
      AND kid_profile_id IS NOT DISTINCT FROM v_kid_id
      AND redeemed_today = true
    RETURNING * INTO v_row;
  END IF;

  IF v_row.redemption_available THEN
    v_display := GREATEST(COALESCE(v_row.streak_before_break, v_row.current_streak), 0);
  ELSE
    v_display := GREATEST(v_row.current_streak, 0);
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_row.current_streak,
    'display_streak', v_display,
    'longest_streak', v_row.longest_streak,
    'redemption_available', v_row.redemption_available,
    'streak_at_risk', v_at_risk,
    'streak_before_break', v_row.streak_before_break,
    'streak_rescued', false,
    'redemption_expired', v_redemption_expired,
    'already_active_today', v_row.last_activity_date = p_today
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- update_user_streak — honour active kid_session_context
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_user_streak(
  p_user_id UUID,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_streaks%ROWTYPE;
  v_kid_id UUID;
  v_gap INTEGER;
  v_current INTEGER;
  v_longest INTEGER;
  v_rescued BOOLEAN := false;
  v_already_today BOOLEAN := false;
  v_display INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_kid_id := public.active_kid_profile_id_for(p_user_id);

  SELECT * INTO v_row
  FROM public.user_streaks
  WHERE user_id = p_user_id
    AND kid_profile_id IS NOT DISTINCT FROM v_kid_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (
      user_id,
      kid_profile_id,
      current_streak,
      longest_streak,
      last_activity_date
    )
    VALUES (p_user_id, v_kid_id, 1, 1, p_today);

    RETURN jsonb_build_object(
      'current_streak', 1,
      'display_streak', 1,
      'longest_streak', 1,
      'redemption_available', false,
      'streak_at_risk', false,
      'streak_rescued', false,
      'redemption_expired', false,
      'already_active_today', false
    );
  END IF;

  v_current := v_row.current_streak;
  v_longest := v_row.longest_streak;

  IF v_row.last_activity_date = p_today THEN
    v_already_today := true;
  ELSIF v_row.redemption_available
    AND NOT v_row.redeemed_today
    AND (v_row.streak_broken_date IS NULL OR p_today <= v_row.streak_broken_date) THEN
    v_current := GREATEST(COALESCE(v_row.streak_before_break, v_row.current_streak) - 1, 1);
    v_rescued := true;
  ELSIF v_row.last_activity_date IS NULL THEN
    v_current := 1;
  ELSE
    v_gap := p_today - v_row.last_activity_date;

    IF v_gap = 1 THEN
      v_current := v_current + 1;
    ELSIF v_gap = 2 THEN
      v_current := GREATEST(COALESCE(v_row.streak_before_break, v_row.current_streak) - 1, 1);
      v_rescued := true;
    ELSIF v_gap >= 3 THEN
      v_current := 1;
    END IF;
  END IF;

  IF v_current > v_longest THEN
    v_longest := v_current;
  END IF;

  UPDATE public.user_streaks
  SET
    current_streak = v_current,
    longest_streak = v_longest,
    last_activity_date = p_today,
    redemption_available = false,
    streak_broken_date = NULL,
    streak_before_break = NULL,
    redeemed_today = CASE WHEN v_rescued THEN true ELSE redeemed_today END
  WHERE user_id = p_user_id
    AND kid_profile_id IS NOT DISTINCT FROM v_kid_id
  RETURNING * INTO v_row;

  v_display := GREATEST(v_row.current_streak, 0);

  RETURN jsonb_build_object(
    'current_streak', v_row.current_streak,
    'display_streak', v_display,
    'longest_streak', v_row.longest_streak,
    'redemption_available', v_row.redemption_available,
    'streak_at_risk', false,
    'streak_before_break', v_row.streak_before_break,
    'streak_rescued', v_rescued,
    'redemption_expired', false,
    'already_active_today', v_already_today
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_user_streak(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_streak(UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- award_xp — write kid_profiles.total_xp when a kid session is active
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_xp(p_xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_kid_id UUID;
  v_new_total INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_xp IS NULL OR p_xp <= 0 OR p_xp > 100 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  v_kid_id := public.active_kid_profile_id_for(v_user_id);

  IF v_kid_id IS NOT NULL THEN
    UPDATE public.kid_profiles
    SET total_xp = total_xp + p_xp
    WHERE id = v_kid_id
      AND parent_user_id = v_user_id
    RETURNING total_xp INTO v_new_total;
  ELSE
    UPDATE public.profiles
    SET total_xp = total_xp + p_xp
    WHERE id = v_user_id
    RETURNING total_xp INTO v_new_total;
  END IF;

  RETURN v_new_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- Weekly leaderboard stays parent-only. Kids must not inflate the parent's week.
-- ---------------------------------------------------------------------------

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

  IF public.active_kid_profile_id_for(v_user_id) IS NOT NULL THEN
    RETURN;
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

GRANT EXECUTE ON FUNCTION public.award_weekly_points(INTEGER, DATE) TO authenticated;

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

  -- Kid sessions use kid_lesson_xp_awarded (TypeScript) so we never mark the
  -- parent's weekly_lesson_points_awarded row.
  IF public.active_kid_profile_id_for(v_user_id) IS NOT NULL THEN
    RETURN false;
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

GRANT EXECUTE ON FUNCTION public.try_award_lesson_completion_points(UUID, DATE) TO authenticated;

-- Count adult streak rows only so a parent + kid studying the same day is one member.
CREATE OR REPLACE FUNCTION public.count_members_studied_on_date(p_activity_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_streaks
  WHERE last_activity_date = p_activity_date
    AND kid_profile_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.count_members_studied_on_date(DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
