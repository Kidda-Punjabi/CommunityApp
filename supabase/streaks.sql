-- =============================================================================
-- Kidda — Streak system (redemption, local-date activity, evaluate on load)
-- Run in Supabase SQL Editor after progress.sql
--
-- Gap rules (p_today - last_activity_date):
--   0 = studied today — active, normal flame
--   1 = studied yesterday — still active, orange "at risk" until end of today
--   2 = missed yesterday — redemption available, show preserved streak
--  3+ = broken — reset current_streak to 0, no redemption
-- =============================================================================

ALTER TABLE public.user_streaks
  ADD COLUMN IF NOT EXISTS streak_broken_date DATE,
  ADD COLUMN IF NOT EXISTS redemption_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeemed_today BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_before_break INTEGER;

COMMENT ON COLUMN public.user_streaks.streak_broken_date IS
  'Calendar day when the redemption window opened (gap = 2).';
COMMENT ON COLUMN public.user_streaks.streak_before_break IS
  'Streak count preserved when redemption becomes available.';

DROP FUNCTION IF EXISTS public.update_user_streak(UUID);

-- -----------------------------------------------------------------------------
-- evaluate_user_streak — call on Home load (no new activity)
-- -----------------------------------------------------------------------------
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
  v_gap INTEGER;
  v_redemption_expired BOOLEAN := false;
  v_at_risk BOOLEAN := false;
  v_display INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_row FROM public.user_streaks WHERE user_id = p_user_id;

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

  -- Missed the redemption day entirely (had rescue window yesterday, did nothing)
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

-- -----------------------------------------------------------------------------
-- update_user_streak — call when a meaningful activity completes
-- -----------------------------------------------------------------------------
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

  SELECT * INTO v_row FROM public.user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_activity_date
    )
    VALUES (p_user_id, 1, 1, p_today);

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

NOTIFY pgrst, 'reload schema';
