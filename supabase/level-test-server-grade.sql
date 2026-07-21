-- =============================================================================
-- Kidda — Grade level tests server-side from submitted answers
-- Replaces client-trusted p_correct_count / p_total_count on record_level_test_attempt
-- Run in Supabase SQL Editor after learner-progression.sql
-- =============================================================================

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

  -- Match client session size (LEVEL_TEST_QUESTION_COUNT = 30)
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
      -- Legacy a/b/c/d MCQ columns
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

GRANT EXECUTE ON FUNCTION public.record_level_test_attempt(INTEGER, JSONB, BOOLEAN, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
