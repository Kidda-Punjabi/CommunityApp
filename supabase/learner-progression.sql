-- =============================================================================
-- Kidda — Learner level, XP, and level-up tests
-- Run in Supabase SQL Editor (includes onboarding profile columns if missing)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_assessed_starting_tier INTEGER
    CHECK (self_assessed_starting_tier IS NULL OR self_assessed_starting_tier BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS stated_goal_motivation TEXT,
  ADD COLUMN IF NOT EXISTS target_tier INTEGER
    CHECK (target_tier IS NULL OR target_tier BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS peak_competency_score INTEGER NOT NULL DEFAULT 0
    CHECK (peak_competency_score BETWEEN 0 AND 100);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learner_level INTEGER
    CHECK (learner_level IS NULL OR (learner_level >= 1 AND learner_level <= 8)),
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0
    CHECK (total_xp >= 0),
  ADD COLUMN IF NOT EXISTS xp_at_level_start INTEGER NOT NULL DEFAULT 0
    CHECK (xp_at_level_start >= 0),
  ADD COLUMN IF NOT EXISTS placement_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.has_seen_onboarding IS
  'True after the user completes or dismisses the first-run onboarding tutorial.';
COMMENT ON COLUMN public.profiles.self_assessed_starting_tier IS
  'Self-assessed tier (1-8) from onboarding/placement; used to derive placement test.';
COMMENT ON COLUMN public.profiles.stated_goal_motivation IS
  'Onboarding goal motivation key (e.g. talk_to_family).';
COMMENT ON COLUMN public.profiles.target_tier IS
  'Onboarding target tier (1-8).';
COMMENT ON COLUMN public.profiles.peak_competency_score IS
  'Legacy ratcheted competency score (0-100); superseded by learner_level in v2.';

COMMENT ON COLUMN public.profiles.learner_level IS
  'Confirmed learner level (1–8). NULL until placement is completed.';
COMMENT ON COLUMN public.profiles.total_xp IS
  'Lifetime XP — always increases, never resets. Shown on profile as total progress.';
COMMENT ON COLUMN public.profiles.xp_at_level_start IS
  'total_xp snapshot when the current learner_level began. Test unlock uses total_xp minus this.';
COMMENT ON COLUMN public.profiles.placement_completed_at IS
  'When initial placement finished. NULL if skipped or not yet done.';

-- ---------------------------------------------------------------------------
-- Level-up test question bank (one pool per transition: from_level → from_level+1)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.level_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_level INTEGER NOT NULL CHECK (from_level >= 1 AND from_level <= 7),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  question_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_test_questions_from_level
  ON public.level_test_questions (from_level, question_order)
  WHERE active = true;

COMMENT ON TABLE public.level_test_questions IS
  'Question bank for level-up tests. from_level 3 = Level 3→4 transition test.';

-- ---------------------------------------------------------------------------
-- Test attempts (placement + ongoing progression)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.level_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  from_level INTEGER NOT NULL CHECK (from_level >= 1 AND from_level <= 7),
  is_placement BOOLEAN NOT NULL DEFAULT false,
  score_pct INTEGER NOT NULL CHECK (score_pct >= 0 AND score_pct <= 100),
  passed BOOLEAN NOT NULL,
  correct_count INTEGER NOT NULL CHECK (correct_count >= 0),
  total_count INTEGER NOT NULL CHECK (total_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_level_test_attempts_user
  ON public.level_test_attempts (user_id, from_level, created_at DESC);

COMMENT ON TABLE public.level_test_attempts IS
  'History of level-up test attempts. passed = score_pct >= 95.';

-- ---------------------------------------------------------------------------
-- Award lifetime XP (monotonic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_xp(p_xp INTEGER)
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
  SET total_xp = total_xp + p_xp
  WHERE id = v_user_id
  RETURNING total_xp INTO v_new_total;

  RETURN v_new_total;
END;
$$;

-- ---------------------------------------------------------------------------
-- Record a level-up test attempt; optionally advance learner_level on pass
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_level_test_attempt(
  p_from_level INTEGER,
  p_correct_count INTEGER,
  p_total_count INTEGER,
  p_is_placement BOOLEAN DEFAULT false,
  p_set_level_on_pass BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_score_pct INTEGER;
  v_passed BOOLEAN;
  v_attempt_id UUID;
  v_current_level INTEGER;
  v_new_level INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_from_level IS NULL OR p_from_level < 1 OR p_from_level > 7 THEN
    RAISE EXCEPTION 'Invalid from_level';
  END IF;

  IF p_total_count IS NULL OR p_total_count <= 0 OR p_correct_count < 0
     OR p_correct_count > p_total_count THEN
    RAISE EXCEPTION 'Invalid attempt counts';
  END IF;

  v_score_pct := ROUND((p_correct_count::NUMERIC / p_total_count) * 100)::INTEGER;
  v_passed := v_score_pct >= 95;

  INSERT INTO public.level_test_attempts (
    user_id, from_level, is_placement, score_pct, passed,
    correct_count, total_count
  )
  VALUES (
    v_user_id, p_from_level, COALESCE(p_is_placement, false), v_score_pct, v_passed,
    p_correct_count, p_total_count
  )
  RETURNING id INTO v_attempt_id;

  SELECT learner_level INTO v_current_level
  FROM public.profiles WHERE id = v_user_id;

  v_new_level := v_current_level;

  IF v_passed AND COALESCE(p_set_level_on_pass, true) AND NOT COALESCE(p_is_placement, false) THEN
    IF v_current_level IS NULL OR v_current_level = p_from_level THEN
      v_new_level := p_from_level + 1;
      UPDATE public.profiles
      SET
        learner_level = v_new_level,
        xp_at_level_start = total_xp
      WHERE id = v_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score_pct', v_score_pct,
    'passed', v_passed,
    'learner_level', v_new_level
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Persist self-assessed claim before placement tests (one-time, server-gated)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.begin_placement(p_claimed_level INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_claimed_level IS NULL OR p_claimed_level < 1 OR p_claimed_level > 8 THEN
    RAISE EXCEPTION 'Invalid claimed level';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND placement_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Placement already completed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.level_test_attempts
    WHERE user_id = v_user_id AND is_placement = true
  ) THEN
    -- Resume: claim already locked in; client may re-open the test UI.
    RETURN;
  END IF;

  UPDATE public.profiles
  SET self_assessed_starting_tier = p_claimed_level
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Finalize placement — derives level from recorded placement attempts only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_placement()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_claimed INTEGER;
  v_expected_confirmation INTEGER;
  v_attempt_count INTEGER;
  v_first RECORD;
  v_second RECORD;
  v_placed INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND placement_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Placement already completed';
  END IF;

  SELECT self_assessed_starting_tier
  INTO v_claimed
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_claimed IS NULL OR v_claimed < 1 OR v_claimed > 8 THEN
    RAISE EXCEPTION 'Self-assessed starting tier required before placement can complete';
  END IF;

  v_expected_confirmation := CASE
    WHEN v_claimed <= 1 THEN 1
    ELSE v_claimed - 1
  END;

  SELECT COUNT(*)::INTEGER
  INTO v_attempt_count
  FROM public.level_test_attempts
  WHERE user_id = v_user_id AND is_placement = true;

  IF v_attempt_count = 0 THEN
    RAISE EXCEPTION 'No placement test attempt found';
  END IF;

  IF v_attempt_count > 2 THEN
    RAISE EXCEPTION 'Too many placement attempts';
  END IF;

  SELECT *
  INTO v_first
  FROM public.level_test_attempts
  WHERE user_id = v_user_id AND is_placement = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_first.from_level IS DISTINCT FROM v_expected_confirmation THEN
    RAISE EXCEPTION 'Invalid placement confirmation test';
  END IF;

  IF v_attempt_count = 1 THEN
    IF v_first.score_pct >= 95 THEN
      IF v_claimed = 1 THEN
        v_placed := 2;
      ELSE
        v_placed := v_claimed;
      END IF;
    ELSIF v_first.score_pct >= 70 THEN
      v_placed := GREATEST(1, v_claimed - 1);
    ELSIF v_claimed = 1 THEN
      v_placed := 1;
    ELSE
      RAISE EXCEPTION 'Follow-up placement test required before completion';
    END IF;
  ELSE
    IF v_first.score_pct >= 70 THEN
      RAISE EXCEPTION 'Follow-up placement test not expected';
    END IF;

    SELECT *
    INTO v_second
    FROM public.level_test_attempts
    WHERE user_id = v_user_id AND is_placement = true
    ORDER BY created_at ASC
    OFFSET 1
    LIMIT 1;

    IF v_second IS NULL OR v_second.from_level <> 1 THEN
      RAISE EXCEPTION 'Invalid follow-up placement test';
    END IF;

    IF v_second.passed THEN
      v_placed := 2;
    ELSE
      v_placed := 1;
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    learner_level = v_placed,
    placement_completed_at = now(),
    xp_at_level_start = CASE WHEN v_placed = 1 THEN 0 ELSE total_xp END
  WHERE id = v_user_id;

  RETURN jsonb_build_object('placed_level', v_placed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_level_test_attempt(INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_placement(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_placement() TO authenticated;

ALTER TABLE public.level_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active level test questions" ON public.level_test_questions;
CREATE POLICY "Authenticated read active level test questions"
  ON public.level_test_questions FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Users read own level test attempts" ON public.level_test_attempts;
CREATE POLICY "Users read own level test attempts"
  ON public.level_test_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.level_test_questions TO authenticated;
GRANT SELECT ON public.level_test_attempts TO authenticated;

NOTIFY pgrst, 'reload schema';
