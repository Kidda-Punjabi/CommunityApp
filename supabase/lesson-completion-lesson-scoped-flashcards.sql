-- =============================================================================
-- Kidda — Count lesson-scoped flashcards (deck_id IS NULL) toward completion
-- Run in Supabase SQL Editor after lesson-completion.sql
-- Needed for Learn English Foundations modules that attach cards via lesson_id only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_lesson_completion_status(
  p_user_id UUID,
  p_lesson_id UUID
)
RETURNS TABLE (
  fully_complete BOOLEAN,
  audio_complete BOOLEAN,
  audio_required BOOLEAN,
  pdf_complete BOOLEAN,
  pdf_required BOOLEAN,
  flashcards_complete BOOLEAN,
  flashcards_required BOOLEAN,
  quiz_complete BOOLEAN,
  quiz_required BOOLEAN,
  parts_total INTEGER,
  parts_done INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pdf_url TEXT;
  v_audio_url TEXT;
  v_audio BOOLEAN := false;
  v_audio_required BOOLEAN := false;
  v_pdf BOOLEAN := false;
  v_pdf_required BOOLEAN := false;
  v_flashcards_required BOOLEAN := false;
  v_flashcards_complete BOOLEAN := true;
  v_quiz_required BOOLEAN := false;
  v_quiz_complete BOOLEAN := true;
  v_total INTEGER := 0;
  v_done INTEGER := 0;
  v_card_total INTEGER := 0;
  v_card_confident INTEGER := 0;
  v_quiz_total INTEGER := 0;
  v_quiz_passed INTEGER := 0;
  v_has_linked_decks BOOLEAN := false;
  v_has_lesson_scoped BOOLEAN := false;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT l.pdf_url, l.audio_url
  INTO v_pdf_url, v_audio_url
  FROM public.lessons AS l
  WHERE l.id = p_lesson_id;

  v_pdf_required := false;
  v_audio_required := false;

  SELECT
    COALESCE(lp.completed, false),
    COALESCE(lp.pdf_completed, false)
  INTO v_audio, v_pdf
  FROM public.lesson_progress AS lp
  WHERE lp.user_id = p_user_id
    AND lp.lesson_id = p_lesson_id;

  IF NOT FOUND THEN
    v_audio := false;
    v_pdf := false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.set_course_links AS scl
    WHERE scl.lesson_id = p_lesson_id
  )
  INTO v_has_linked_decks;

  SELECT EXISTS (
    SELECT 1
    FROM public.flashcards AS f
    WHERE f.lesson_id = p_lesson_id
      AND f.deck_id IS NULL
  )
  INTO v_has_lesson_scoped;

  v_flashcards_required := v_has_linked_decks OR v_has_lesson_scoped;

  IF v_flashcards_required THEN
    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (
        WHERE fp.confidence = 'confident'
      )::INTEGER
    INTO v_card_total, v_card_confident
    FROM (
      SELECT f.id
      FROM public.set_course_links AS scl
      JOIN public.flashcards AS f ON f.deck_id = scl.deck_id
      WHERE scl.lesson_id = p_lesson_id
      UNION
      SELECT f.id
      FROM public.flashcards AS f
      WHERE f.lesson_id = p_lesson_id
        AND f.deck_id IS NULL
    ) AS cards(id)
    LEFT JOIN public.flashcard_progress AS fp
      ON fp.flashcard_id = cards.id
     AND fp.user_id = p_user_id;

    v_flashcards_complete := v_card_total > 0 AND v_card_total = v_card_confident;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_quiz_total
  FROM public.get_lesson_quizzes(p_lesson_id);

  v_quiz_required := v_quiz_total > 0;

  IF v_quiz_required THEN
    SELECT COUNT(*)::INTEGER
    INTO v_quiz_passed
    FROM public.get_lesson_quizzes(p_lesson_id) AS lq
    JOIN public.quiz_progress AS qp
      ON qp.quiz_id = lq.quiz_id
     AND qp.user_id = p_user_id
     AND qp.completed = true
     AND (
       COALESCE(qp.score, 0) >= 80
       OR (
         (SELECT COUNT(*)::INTEGER FROM public.quiz_questions qq WHERE qq.quiz_id = lq.quiz_id) > 0
         AND (
           qp.score::NUMERIC
           / (SELECT COUNT(*)::INTEGER FROM public.quiz_questions qq WHERE qq.quiz_id = lq.quiz_id)
         ) * 100 >= 80
       )
     );

    v_quiz_complete := v_quiz_passed = v_quiz_total;
  END IF;

  v_total :=
    (CASE WHEN v_flashcards_required THEN 1 ELSE 0 END)
    + (CASE WHEN v_quiz_required THEN 1 ELSE 0 END);

  v_done :=
    (CASE WHEN v_flashcards_required AND v_flashcards_complete THEN 1 ELSE 0 END)
    + (CASE WHEN v_quiz_required AND v_quiz_complete THEN 1 ELSE 0 END);

  RETURN QUERY
  SELECT
    v_total > 0 AND v_done = v_total,
    v_audio,
    v_audio_required,
    v_pdf,
    v_pdf_required,
    v_flashcards_complete,
    v_flashcards_required,
    v_quiz_complete,
    v_quiz_required,
    v_total,
    v_done;
END;
$$;
