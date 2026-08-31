-- =============================================================================
-- Kidda — Assigned tutor access (read + manage cohort-scoped rows)
-- Run in Supabase SQL Editor after tutor-cohort-access.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: tutor assigned to a cohort (via cohort.tutor_id or enrollments)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tutor_can_manage_cohort(p_cohort_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.cohorts co
      WHERE co.id = p_cohort_id
        AND co.tutor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      WHERE ce.cohort_id = p_cohort_id
        AND ce.tutor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.tutor_cover_requests cr
      JOIN public.tutor_scheduled_sessions s ON s.id = cr.session_id
      WHERE s.cohort_id = p_cohort_id
        AND cr.assigned_tutor_id = auth.uid()
        AND cr.status IN ('assigned', 'confirmed')
    );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_manage_cohort(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cohorts: read rows for assigned tutors
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff read cohorts" ON public.cohorts;
CREATE POLICY "Staff read cohorts"
  ON public.cohorts FOR SELECT TO authenticated
  USING (
    public.tutor_can_manage_cohort(id)
    OR EXISTS (
      SELECT 1
      FROM public.cohort_members cm
      WHERE cm.cohort_id = id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Staff manage cohorts" ON public.cohorts;
CREATE POLICY "Staff manage cohorts"
  ON public.cohorts FOR ALL TO authenticated
  USING (public.tutor_can_manage_cohort(id))
  WITH CHECK (public.tutor_can_manage_cohort(id));

-- ---------------------------------------------------------------------------
-- Cohort lesson unlocks: read + manage for assigned tutors
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Read cohort unlocks" ON public.cohort_lesson_unlocks;
CREATE POLICY "Read cohort unlocks"
  ON public.cohort_lesson_unlocks FOR SELECT TO authenticated
  USING (
    public.tutor_can_manage_cohort(cohort_id)
    OR EXISTS (
      SELECT 1
      FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_lesson_unlocks.cohort_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Staff manage cohort unlocks" ON public.cohort_lesson_unlocks;
CREATE POLICY "Staff manage cohort unlocks"
  ON public.cohort_lesson_unlocks FOR ALL TO authenticated
  USING (public.tutor_can_manage_cohort(cohort_id))
  WITH CHECK (public.tutor_can_manage_cohort(cohort_id));

-- ---------------------------------------------------------------------------
-- Lesson recordings: cohort-scoped writes for assigned tutors
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff manage lesson recordings" ON public.lesson_recordings;
CREATE POLICY "Staff manage lesson recordings"
  ON public.lesson_recordings FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR (
      student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.course_enrollments ce
        WHERE ce.user_id = lesson_recordings.student_id
          AND ce.tutor_id = auth.uid()
      )
    )
    OR (
      cohort_id IS NOT NULL
      AND public.tutor_can_manage_cohort(lesson_recordings.cohort_id)
    )
  )
  WITH CHECK (
    public.is_master_admin()
    OR (
      uploaded_by = auth.uid()
      AND (
        (
          student_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.user_id = lesson_recordings.student_id
              AND ce.tutor_id = auth.uid()
          )
        )
        OR (
          cohort_id IS NOT NULL
          AND public.tutor_can_manage_cohort(lesson_recordings.cohort_id)
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
