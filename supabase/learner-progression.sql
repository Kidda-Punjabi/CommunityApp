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
-- Record a level-up test attempt; grade answers server-side
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.record_level_test_attempt(INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.record_level_test_attempt(
  p_from_level INTEGER,
  p_answers JSONB,
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
  v_correct_count INTEGER := 0;
  v_total_count INTEGER;
  v_expected_count INTEGER;
  v_available_count INTEGER;
  v_answer JSONB;
  v_question_id UUID;
  v_question RECORD;
  v_seen UUID[] := ARRAY[]::UUID[];
  v_is_correct BOOLEAN;
  v_selected_index INTEGER;
  v_selected_text TEXT;
  v_tiles TEXT[];
  v_correct_tiles TEXT[];
  v_content JSONB;
  v_legacy_map TEXT[];
  v_i INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_from_level IS NULL OR p_from_level < 1 OR p_from_level > 7 THEN
    RAISE EXCEPTION 'Invalid from_level';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Answers required';
  END IF;

  v_total_count := jsonb_array_length(p_answers);

  SELECT COUNT(*)::INTEGER
  INTO v_available_count
  FROM public.level_test_questions
  WHERE from_level = p_from_level
    AND active = true;

  IF v_available_count <= 0 THEN
    RAISE EXCEPTION 'No active questions for this level';
  END IF;

  v_expected_count := LEAST(30, v_available_count);

  IF v_total_count <> v_expected_count THEN
    RAISE EXCEPTION 'Invalid answer count';
  END IF;

  FOR v_i IN 0 .. v_total_count - 1 LOOP
    v_answer := p_answers -> v_i;
    IF v_answer IS NULL OR jsonb_typeof(v_answer) <> 'object' THEN
      RAISE EXCEPTION 'Invalid answer entry';
    END IF;

    BEGIN
      v_question_id := (v_answer ->> 'question_id')::UUID;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'Invalid question_id';
    END;

    IF v_question_id = ANY (v_seen) THEN
      RAISE EXCEPTION 'Duplicate question in answers';
    END IF;
    v_seen := array_append(v_seen, v_question_id);

    SELECT *
    INTO v_question
    FROM public.level_test_questions
    WHERE id = v_question_id
      AND from_level = p_from_level
      AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown or inactive question';
    END IF;

    v_is_correct := false;
    v_content := COALESCE(v_question.content, '{}'::jsonb);

    IF v_question.question_type = 'mcq' AND v_content ? 'correct_index' THEN
      BEGIN
        v_selected_index := (v_answer ->> 'selected_index')::INTEGER;
      EXCEPTION
        WHEN others THEN
          v_selected_index := NULL;
      END;
      IF v_selected_index IS NOT NULL
         AND v_selected_index = (v_content ->> 'correct_index')::INTEGER THEN
        v_is_correct := true;
      END IF;

    ELSIF v_question.question_type = 'conjugation_fill_blank' THEN
      v_selected_text := NULLIF(trim(COALESCE(v_answer ->> 'selected_gurmukhi', '')), '');
      IF v_selected_text IS NOT NULL
         AND v_selected_text = NULLIF(trim(COALESCE(v_content ->> 'target_verb_gurmukhi', '')), '') THEN
        v_is_correct := true;
      END IF;

    ELSIF v_question.question_type = 'sentence_builder' THEN
      IF jsonb_typeof(v_answer -> 'selected_tiles') = 'array' THEN
        SELECT COALESCE(array_agg(value ORDER BY ordinality), ARRAY[]::TEXT[])
        INTO v_tiles
        FROM jsonb_array_elements_text(v_answer -> 'selected_tiles') WITH ORDINALITY AS t(value, ordinality);

        SELECT COALESCE(
          array_agg(trim(both FROM tile ->> 'gurmukhi') ORDER BY ordinality),
          ARRAY[]::TEXT[]
        )
        INTO v_correct_tiles
        FROM jsonb_array_elements(COALESCE(v_content -> 'word_tiles', '[]'::jsonb))
          WITH ORDINALITY AS t(tile, ordinality)
        WHERE NULLIF(trim(both FROM tile ->> 'gurmukhi'), '') IS NOT NULL;

        IF v_tiles IS NOT NULL
           AND v_correct_tiles IS NOT NULL
           AND cardinality(v_tiles) = cardinality(v_correct_tiles)
           AND v_tiles = v_correct_tiles THEN
          v_is_correct := true;
        END IF;
      END IF;

    ELSIF v_question.correct_answer IS NOT NULL
          AND v_question.option_a IS NOT NULL THEN
      v_selected_text := lower(NULLIF(trim(COALESCE(v_answer ->> 'selected_option', '')), ''));
      BEGIN
        v_selected_index := (v_answer ->> 'selected_index')::INTEGER;
      EXCEPTION
        WHEN others THEN
          v_selected_index := NULL;
      END;

      v_legacy_map := ARRAY['a', 'b', 'c', 'd'];
      IF v_selected_text IS NOT NULL
         AND v_selected_text = lower(v_question.correct_answer) THEN
        v_is_correct := true;
      ELSIF v_selected_index IS NOT NULL
            AND v_selected_index BETWEEN 0 AND 3
            AND v_legacy_map[v_selected_index + 1] = lower(v_question.correct_answer) THEN
        v_is_correct := true;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported question type';
    END IF;

    IF v_is_correct THEN
      v_correct_count := v_correct_count + 1;
    END IF;
  END LOOP;

  v_score_pct := ROUND((v_correct_count::NUMERIC / v_total_count) * 100)::INTEGER;
  v_passed := v_score_pct >= 95;

  INSERT INTO public.level_test_attempts (
    user_id, from_level, is_placement, score_pct, passed,
    correct_count, total_count
  )
  VALUES (
    v_user_id, p_from_level, COALESCE(p_is_placement, false), v_score_pct, v_passed,
    v_correct_count, v_total_count
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
    'correct_count', v_correct_count,
    'total_count', v_total_count,
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
GRANT EXECUTE ON FUNCTION public.record_level_test_attempt(INTEGER, JSONB, BOOLEAN, BOOLEAN) TO authenticated;
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
