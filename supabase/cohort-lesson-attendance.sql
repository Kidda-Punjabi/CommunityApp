-- =============================================================================
-- Kidda — Group cohort lesson attendance (manual, per student)
-- Run in Supabase SQL Editor after tutor-cohort-access.sql and
-- tutor-cohort-assigned-read.sql (uses tutor_can_manage_cohort).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cohort_lesson_attendance (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id  UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  lesson_id  UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  attended   BOOLEAN NOT NULL,
  marked_by  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, lesson_id, student_id)
);

COMMENT ON TABLE public.cohort_lesson_attendance IS
  'Per-student attendance for a group cohort live session. One row per cohort+lesson+student. Manually marked by the tutor — not auto-derived from cohort_lesson_unlocks. Editable any time (no lock), most recent state wins.';
COMMENT ON COLUMN public.cohort_lesson_attendance.attended IS
  'true = present, false = absent. No third state (e.g. late/excused) in v1.';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_attendance_cohort_lesson
  ON public.cohort_lesson_attendance (cohort_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_attendance_student
  ON public.cohort_lesson_attendance (student_id);

-- ---------------------------------------------------------------------------
-- Validation: lesson must belong to the cohort's course
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_cohort_lesson_attendance_scope()
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

DROP TRIGGER IF EXISTS trg_cohort_lesson_attendance_scope ON public.cohort_lesson_attendance;
CREATE TRIGGER trg_cohort_lesson_attendance_scope
  BEFORE INSERT OR UPDATE ON public.cohort_lesson_attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cohort_lesson_attendance_scope();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_lesson_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Students read own attendance"
  ON public.cohort_lesson_attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Tutors read cohort attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Tutors read cohort attendance"
  ON public.cohort_lesson_attendance FOR SELECT TO authenticated
  USING (public.tutor_can_manage_cohort(cohort_id));

DROP POLICY IF EXISTS "Tutors manage cohort attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Tutors manage cohort attendance"
  ON public.cohort_lesson_attendance FOR INSERT TO authenticated
  WITH CHECK (
    public.tutor_can_manage_cohort(cohort_id)
    AND marked_by = auth.uid()
  );

DROP POLICY IF EXISTS "Tutors update cohort attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Tutors update cohort attendance"
  ON public.cohort_lesson_attendance FOR UPDATE TO authenticated
  USING (public.tutor_can_manage_cohort(cohort_id))
  WITH CHECK (
    public.tutor_can_manage_cohort(cohort_id)
    AND marked_by = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.cohort_lesson_attendance TO authenticated;

NOTIFY pgrst, 'reload schema';
