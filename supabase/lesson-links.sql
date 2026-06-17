-- Run this in Supabase Dashboard → SQL Editor (required for flashcard ↔ lesson linking).
-- Quizzes link via course_id + level_number without this migration.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.lessons (id) ON DELETE SET NULL;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.lessons (id) ON DELETE CASCADE;

-- App links flashcards to lessons; quiz_id is optional (auto-filled when a quiz exists)
ALTER TABLE public.flashcards
  ALTER COLUMN quiz_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id ON public.quizzes (lesson_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_lesson_id ON public.flashcards (lesson_id);

-- Backfill quiz links from course + level_number = lesson_number
UPDATE public.quizzes q
SET lesson_id = l.id
FROM public.lessons l
WHERE q.lesson_id IS NULL
  AND l.course_id = q.course_id
  AND l.lesson_number = q.level_number;

NOTIFY pgrst, 'reload schema';
