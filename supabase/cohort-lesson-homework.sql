-- =============================================================================
-- Kidda — Group cohort lesson homework (manual, per student)
-- Mirrors cohort_lesson_attendance so the app has a queryable record;
-- Notion Lessons Log "Homework" relation remains the payroll/ops source of truth
-- once pushed from the app.
-- Run after cohort-lesson-attendance.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cohort_lesson_homework (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id    UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  completed    BOOLEAN NOT NULL,
  marked_by    UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  marked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, lesson_id, student_id)
);

COMMENT ON TABLE public.cohort_lesson_homework IS
  'Per-student homework completion for a group cohort live session. Mirrors cohort_lesson_attendance. App record + Notion Homework relation push.';
COMMENT ON COLUMN public.cohort_lesson_homework.completed IS
  'true = homework done, false = not done.';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_homework_cohort_lesson
  ON public.cohort_lesson_homework (cohort_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_homework_student
  ON public.cohort_lesson_homework (student_id);

CREATE OR REPLACE FUNCTION public.enforce_cohort_lesson_homework_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.cohorts co ON co.id = NEW.cohort_id
    WHERE l.id = NEW.lesson_id
      AND l.course_id = co.course_id
  ) THEN
    RAISE EXCEPTION 'lesson_id must belong to the cohort''s course.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohort_lesson_homework_scope ON public.cohort_lesson_homework;
CREATE TRIGGER trg_cohort_lesson_homework_scope
  BEFORE INSERT OR UPDATE ON public.cohort_lesson_homework
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cohort_lesson_homework_scope();

ALTER TABLE public.cohort_lesson_homework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own homework marks" ON public.cohort_lesson_homework;
CREATE POLICY "Students read own homework marks"
  ON public.cohort_lesson_homework FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Tutors read cohort homework" ON public.cohort_lesson_homework;
CREATE POLICY "Tutors read cohort homework"
  ON public.cohort_lesson_homework FOR SELECT TO authenticated
  USING (public.tutor_can_manage_cohort(cohort_id));

DROP POLICY IF EXISTS "Tutors manage cohort homework" ON public.cohort_lesson_homework;
CREATE POLICY "Tutors manage cohort homework"
  ON public.cohort_lesson_homework FOR INSERT TO authenticated
  WITH CHECK (
    public.tutor_can_manage_cohort(cohort_id)
    AND marked_by = auth.uid()
  );

DROP POLICY IF EXISTS "Tutors update cohort homework" ON public.cohort_lesson_homework;
CREATE POLICY "Tutors update cohort homework"
  ON public.cohort_lesson_homework FOR UPDATE TO authenticated
  USING (public.tutor_can_manage_cohort(cohort_id))
  WITH CHECK (
    public.tutor_can_manage_cohort(cohort_id)
    AND marked_by = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.cohort_lesson_homework TO authenticated;

NOTIFY pgrst, 'reload schema';
