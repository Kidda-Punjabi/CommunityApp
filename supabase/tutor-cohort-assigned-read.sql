-- =============================================================================
-- Kidda — Let assigned tutors read their cohort rows without global is_tutor()
-- Run in Supabase SQL Editor after tutor-cohort-access.sql
-- =============================================================================

DROP POLICY IF EXISTS "Staff read cohorts" ON public.cohorts;
CREATE POLICY "Staff read cohorts"
  ON public.cohorts FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_tutor()
    OR tutor_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.cohort_members cm
      WHERE cm.cohort_id = id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      WHERE ce.cohort_id = id
        AND ce.tutor_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
