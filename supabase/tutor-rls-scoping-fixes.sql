-- =============================================================================
-- Kidda — Tutor RLS scoping fixes
-- Run in Supabase SQL Editor after tutor-cohort-assigned-read.sql
--
-- Fixes:
--   1. tutor_can_manage_cohort() — remove blanket is_tutor() bypass
--   2. cohort_lesson_log_entries — tutor INSERT/UPDATE (scoped like SELECT)
--   3. student_packages — tutor SELECT/UPDATE via tutor_can_access_student_package()
--   4. cohorts — tighten read/manage to assigned tutors only
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Scoped cohort access helper (fix blanket tutor bypass)
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
-- 2. student_packages tutor access (reuse onboarding scoping helper)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tutor_can_access_student_package(p_student_package_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_packages sp
    LEFT JOIN public.course_enrollments ce_by_id
      ON ce_by_id.id = sp.enrollment_id
    LEFT JOIN public.course_enrollments ce_by_course
      ON ce_by_course.user_id = sp.user_id
     AND ce_by_course.course_id = sp.course_id
    LEFT JOIN public.package_instances pi
      ON pi.id = sp.package_instance_id
    WHERE sp.id = p_student_package_id
      AND (
        ce_by_id.tutor_id = auth.uid()
        OR ce_by_course.tutor_id = auth.uid()
        OR pi.tutor_id = auth.uid()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_access_student_package(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tutors read assigned student packages" ON public.student_packages;
CREATE POLICY "Tutors read assigned student packages"
  ON public.student_packages FOR SELECT TO authenticated
  USING (
    public.is_tutor()
    AND public.tutor_can_access_student_package(id)
  );

DROP POLICY IF EXISTS "Tutors update assigned student packages" ON public.student_packages;
CREATE POLICY "Tutors update assigned student packages"
  ON public.student_packages FOR UPDATE TO authenticated
  USING (
    public.is_tutor()
    AND public.tutor_can_access_student_package(id)
  )
  WITH CHECK (
    public.is_tutor()
    AND public.tutor_can_access_student_package(id)
  );

GRANT UPDATE ON public.student_packages TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. cohort_lesson_log_entries — tutor writes (match existing SELECT scope)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tutor_can_manage_lesson_log_entry(
  p_cohort_id UUID,
  p_package_instance_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    p_cohort_id IS NOT NULL
    AND public.tutor_can_manage_cohort(p_cohort_id)
  )
  OR (
    p_package_instance_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.package_instances pi
      WHERE pi.id = p_package_instance_id
        AND pi.tutor_id = auth.uid()
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_manage_lesson_log_entry(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Tutors insert own cohort lesson logs"
  ON public.cohort_lesson_log_entries;
CREATE POLICY "Tutors insert own cohort lesson logs"
  ON public.cohort_lesson_log_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.tutor_can_manage_lesson_log_entry(cohort_id, package_instance_id)
  );

DROP POLICY IF EXISTS "Tutors update own cohort lesson logs"
  ON public.cohort_lesson_log_entries;
CREATE POLICY "Tutors update own cohort lesson logs"
  ON public.cohort_lesson_log_entries FOR UPDATE TO authenticated
  USING (
    public.tutor_can_manage_lesson_log_entry(cohort_id, package_instance_id)
  )
  WITH CHECK (
    public.tutor_can_manage_lesson_log_entry(cohort_id, package_instance_id)
  );

GRANT INSERT, UPDATE ON public.cohort_lesson_log_entries TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. cohorts — assigned tutors only (not every tutor in the system)
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

NOTIFY pgrst, 'reload schema';
