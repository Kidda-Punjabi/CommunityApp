-- =============================================================================
-- Kidda — Lesson completion & course progress
-- Run in Supabase SQL Editor
-- Prerequisite: progress.sql, lesson-links.sql, flashcard-sets.sql, lesson-pdfs.sql
-- =============================================================================

-- Helper: quizzes linked to a lesson (lesson_id or course + level match)
CREATE OR REPLACE FUNCTION public.get_lesson_quizzes(p_lesson_id UUID)
RETURNS TABLE (quiz_id UUID)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT q.id
  FROM public.quizzes AS q
  JOIN public.lessons AS l ON l.id = p_lesson_id
  WHERE q.lesson_id = p_lesson_id
     OR (
       q.lesson_id IS NULL
       AND q.course_id = l.course_id
       AND q.level_number = l.lesson_number
     );
$$;

-- -----------------------------------------------------------------------------
-- get_lesson_completion_status
-- -----------------------------------------------------------------------------
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
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT l.pdf_url, l.audio_url
  INTO v_pdf_url, v_audio_url
  FROM public.lessons AS l
  WHERE l.id = p_lesson_id;

  v_pdf_required := COALESCE(v_pdf_url, '') <> '';
  v_audio_required := COALESCE(v_audio_url, '') <> '';

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
  INTO v_flashcards_required;

  IF v_flashcards_required THEN
    SELECT
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (
        WHERE fp.confidence = 'confident'
      )::INTEGER
    INTO v_card_total, v_card_confident
    FROM public.set_course_links AS scl
    JOIN public.flashcards AS f ON f.deck_id = scl.deck_id
    LEFT JOIN public.flashcard_progress AS fp
      ON fp.flashcard_id = f.id
     AND fp.user_id = p_user_id
    WHERE scl.lesson_id = p_lesson_id;

    v_flashcards_complete := v_card_total = v_card_confident;
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
    (CASE WHEN v_pdf_required THEN 1 ELSE 0 END)
    + (CASE WHEN v_audio_required THEN 1 ELSE 0 END)
    + (CASE WHEN v_flashcards_required THEN 1 ELSE 0 END)
    + (CASE WHEN v_quiz_required THEN 1 ELSE 0 END);

  v_done :=
    (CASE WHEN v_pdf_required AND v_pdf THEN 1 ELSE 0 END)
    + (CASE WHEN v_audio_required AND v_audio THEN 1 ELSE 0 END)
    + (CASE WHEN v_flashcards_required AND v_flashcards_complete THEN 1 ELSE 0 END)
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

-- -----------------------------------------------------------------------------
-- get_course_progress
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_course_progress(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  total_lessons INTEGER,
  completed_lessons INTEGER,
  percentage INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  v_completed INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total
  FROM public.lessons AS l
  WHERE l.course_id = p_course_id;

  SELECT COUNT(*)::INTEGER
  INTO v_completed
  FROM public.lessons AS l
  CROSS JOIN LATERAL public.get_lesson_completion_status(p_user_id, l.id) AS s
  WHERE l.course_id = p_course_id
    AND s.fully_complete;

  RETURN QUERY
  SELECT
    v_total,
    v_completed,
    CASE
      WHEN v_total = 0 THEN 0
      ELSE ROUND(100.0 * v_completed / v_total)::INTEGER
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lesson_completion_status(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lesson_quizzes(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_course_progress(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
