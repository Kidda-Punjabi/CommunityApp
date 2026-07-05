-- =============================================================================
-- Kidda — Catch-up Week 2+ activity types (fill-blank, translate, written homework)
-- Run in Supabase SQL Editor after catchup-lesson-segments.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend lesson_segments.activity_type
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_segments
  DROP CONSTRAINT IF EXISTS lesson_segments_activity_type_check;

ALTER TABLE public.lesson_segments
  ADD CONSTRAINT lesson_segments_activity_type_check
  CHECK (activity_type IN (
    'none',
    'quiz',
    'flashcard_set',
    'game',
    'homework',
    'external_link',
    'fill_blank',
    'translate',
    'record_practice'
  ));

ALTER TABLE public.lesson_segments
  ADD COLUMN IF NOT EXISTS homework_submission_type TEXT NOT NULL DEFAULT 'voice'
    CHECK (homework_submission_type IN ('voice', 'text'));

COMMENT ON COLUMN public.lesson_segments.homework_submission_type IS
  'For homework segments: voice = record audio (Week 1 style), text = written translation homework.';

-- ---------------------------------------------------------------------------
-- fill_blank_questions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fill_blank_questions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id               UUID NOT NULL REFERENCES public.lesson_segments (id) ON DELETE CASCADE,
  question_number          INTEGER NOT NULL CHECK (question_number > 0),
  prompt_gurmukhi          TEXT NOT NULL,
  prompt_romanised         TEXT,
  prompt_english           TEXT,
  blank_answer_gurmukhi    TEXT,
  blank_answer_romanised   TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fill_blank_questions_segment_number_unique UNIQUE (segment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_fill_blank_questions_segment
  ON public.fill_blank_questions (segment_id, question_number);

COMMENT ON TABLE public.fill_blank_questions IS
  'Fill-in-the-blank exercises for catch-up segments. Checked via fuzzy romanised match.';

-- ---------------------------------------------------------------------------
-- translate_questions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.translate_questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id         UUID NOT NULL REFERENCES public.lesson_segments (id) ON DELETE CASCADE,
  question_number    INTEGER NOT NULL CHECK (question_number > 0),
  prompt_english     TEXT NOT NULL,
  answer_gurmukhi    TEXT,
  answer_romanised   TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT translate_questions_segment_number_unique UNIQUE (segment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_translate_questions_segment
  ON public.translate_questions (segment_id, question_number);

COMMENT ON TABLE public.translate_questions IS
  'English-to-Punjabi translation exercises for catch-up segments.';

-- ---------------------------------------------------------------------------
-- homework_text_questions (written homework prompts + tutor answer keys)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.homework_text_questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id         UUID NOT NULL REFERENCES public.lesson_segments (id) ON DELETE CASCADE,
  question_number    INTEGER NOT NULL CHECK (question_number > 0),
  prompt_english     TEXT NOT NULL,
  answer_gurmukhi    TEXT,
  answer_romanised   TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT homework_text_questions_segment_number_unique UNIQUE (segment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_homework_text_questions_segment
  ON public.homework_text_questions (segment_id, question_number);

COMMENT ON TABLE public.homework_text_questions IS
  'Written homework prompts for catch-up segments. Answer keys shown to tutors only.';

-- ---------------------------------------------------------------------------
-- RLS for question tables (read when segment lesson unlocked; staff manage)
-- ---------------------------------------------------------------------------

ALTER TABLE public.fill_blank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translate_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_text_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read fill blank when lesson unlocked" ON public.fill_blank_questions;
CREATE POLICY "Read fill blank when lesson unlocked"
  ON public.fill_blank_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_segments ls
      WHERE ls.id = segment_id
        AND public.is_lesson_content_unlocked(auth.uid(), ls.lesson_id)
    )
  );

DROP POLICY IF EXISTS "Staff manage fill blank questions" ON public.fill_blank_questions;
CREATE POLICY "Staff manage fill blank questions"
  ON public.fill_blank_questions FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_master_admin())
  WITH CHECK (public.is_staff() OR public.is_master_admin());

DROP POLICY IF EXISTS "Read translate when lesson unlocked" ON public.translate_questions;
CREATE POLICY "Read translate when lesson unlocked"
  ON public.translate_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_segments ls
      WHERE ls.id = segment_id
        AND public.is_lesson_content_unlocked(auth.uid(), ls.lesson_id)
    )
  );

DROP POLICY IF EXISTS "Staff manage translate questions" ON public.translate_questions;
CREATE POLICY "Staff manage translate questions"
  ON public.translate_questions FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_master_admin())
  WITH CHECK (public.is_staff() OR public.is_master_admin());

DROP POLICY IF EXISTS "Read homework text when lesson unlocked" ON public.homework_text_questions;
CREATE POLICY "Read homework text when lesson unlocked"
  ON public.homework_text_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_segments ls
      WHERE ls.id = segment_id
        AND public.is_lesson_content_unlocked(auth.uid(), ls.lesson_id)
    )
  );

DROP POLICY IF EXISTS "Staff manage homework text questions" ON public.homework_text_questions;
CREATE POLICY "Staff manage homework text questions"
  ON public.homework_text_questions FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_master_admin())
  WITH CHECK (public.is_staff() OR public.is_master_admin());

GRANT SELECT ON public.fill_blank_questions TO authenticated;
GRANT SELECT ON public.translate_questions TO authenticated;
GRANT SELECT ON public.homework_text_questions TO authenticated;
GRANT ALL ON public.fill_blank_questions TO service_role;
GRANT ALL ON public.translate_questions TO service_role;
GRANT ALL ON public.homework_text_questions TO service_role;

NOTIFY pgrst, 'reload schema';
