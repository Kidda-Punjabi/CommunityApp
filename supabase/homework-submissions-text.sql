-- =============================================================================
-- Kidda — Written homework submissions (extends voice homework)
-- Run after homework-submissions.sql and catchup-week2-activities.sql
-- =============================================================================

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'voice'
    CHECK (submission_type IN ('voice', 'text'));

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS text_answers JSONB;

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS is_practice BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.homework_submissions
  ALTER COLUMN storage_path DROP NOT NULL;

COMMENT ON COLUMN public.homework_submissions.submission_type IS
  'voice = audio recording (default), text = written translation homework.';
COMMENT ON COLUMN public.homework_submissions.text_answers IS
  'Array of {question_number, answer_text} for text homework.';
COMMENT ON COLUMN public.homework_submissions.is_practice IS
  'Practice recordings are optional and excluded from tutor review queue.';

-- One formal homework per student per lesson; practice rows do not count toward the limit
ALTER TABLE public.homework_submissions
  DROP CONSTRAINT IF EXISTS homework_submissions_lesson_id_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS homework_submissions_one_formal_per_lesson
  ON public.homework_submissions (lesson_id, student_id)
  WHERE is_practice = false;

-- Voice submissions require storage_path; text submissions require text_answers
ALTER TABLE public.homework_submissions
  DROP CONSTRAINT IF EXISTS homework_submissions_payload_check;

ALTER TABLE public.homework_submissions
  ADD CONSTRAINT homework_submissions_payload_check CHECK (
    (submission_type = 'voice' AND storage_path IS NOT NULL AND char_length(trim(storage_path)) > 0)
    OR (
      submission_type = 'text'
      AND text_answers IS NOT NULL
      AND jsonb_typeof(text_answers) = 'array'
      AND jsonb_array_length(text_answers) > 0
    )
  );

-- ---------------------------------------------------------------------------
-- Update review trigger: tutors may not change submission payload fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_homework_submission_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'reviewed' THEN
    RAISE EXCEPTION 'Reviewed homework submissions cannot be modified.';
  END IF;

  IF auth.uid() = OLD.student_id THEN
    RAISE EXCEPTION 'Students cannot update homework after submission.';
  END IF;

  IF TG_OP = 'UPDATE' AND (public.is_tutor() OR public.is_master_admin()) THEN
    IF NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.submission_type IS DISTINCT FROM OLD.submission_type
       OR NEW.text_answers IS DISTINCT FROM OLD.text_answers
       OR NEW.is_practice IS DISTINCT FROM OLD.is_practice THEN
      RAISE EXCEPTION 'Tutors may only update review fields on homework submissions.';
    END IF;

    IF NEW.status <> 'reviewed' THEN
      RAISE EXCEPTION 'Tutor review must set status to reviewed.';
    END IF;

    IF NEW.approved IS NULL THEN
      RAISE EXCEPTION 'approved must be set when marking homework as reviewed.';
    END IF;

    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Practice submissions should not appear in tutor queue
CREATE OR REPLACE FUNCTION public.enforce_homework_submission_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT c.required_tier INTO v_tier
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = NEW.lesson_id;

  IF COALESCE(v_tier, '') NOT IN ('foundational', 'beginners') THEN
    RAISE EXCEPTION 'Homework submissions are only allowed for Foundational and Beginners courses.';
  END IF;

  IF NEW.is_practice = true AND NEW.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Practice submissions must stay pending_review.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
