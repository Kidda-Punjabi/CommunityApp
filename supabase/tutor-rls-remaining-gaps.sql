-- =============================================================================
-- Kidda — Tutor RLS remaining gaps (cohort_members, package_instances, storage)
-- Apply after tutor-rls-scoping-fixes.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. cohort_members — assigned tutors only (not every tutor)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Read cohort membership" ON public.cohort_members;
CREATE POLICY "Read cohort membership"
  ON public.cohort_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_master_admin()
    OR public.tutor_can_manage_cohort(cohort_id)
  );

DROP POLICY IF EXISTS "Staff manage cohort members" ON public.cohort_members;
CREATE POLICY "Staff manage cohort members"
  ON public.cohort_members FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR public.tutor_can_manage_cohort(cohort_id)
  )
  WITH CHECK (
    public.is_master_admin()
    OR public.tutor_can_manage_cohort(cohort_id)
  );

-- ---------------------------------------------------------------------------
-- 2. package_instances — assigned tutor / community lead (no bare is_tutor())
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff read package instances" ON public.package_instances;
CREATE POLICY "Staff read package instances"
  ON public.package_instances FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_community_lead()
    OR tutor_id = auth.uid()
  );

DROP POLICY IF EXISTS "Staff manage package instances" ON public.package_instances;
CREATE POLICY "Staff manage package instances"
  ON public.package_instances FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_community_lead()
    OR tutor_id = auth.uid()
  )
  WITH CHECK (
    public.is_master_admin()
    OR public.is_community_lead()
    OR tutor_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 3. Storage lesson-recordings — path must match assigned student/cohort
-- Path layout (from tutor-cohort-access.sql):
--   lessons/{lesson_id}/students/{student_id}/{file}
--   lessons/{lesson_id}/cohorts/{cohort_id}/{file}
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff upload lesson recordings" ON storage.objects;
CREATE POLICY "Staff upload lesson recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-recordings'
    AND (
      public.is_master_admin()
      OR (
        public.is_tutor()
        AND (
          EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/students/' || ce.user_id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.cohorts co
            WHERE co.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/cohorts/' || co.id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND ce.cohort_id IS NOT NULL
              AND name LIKE ('lessons/%/cohorts/' || ce.cohort_id::text || '/%')
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Staff update lesson recordings" ON storage.objects;
CREATE POLICY "Staff update lesson recordings"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (
      public.is_master_admin()
      OR (
        public.is_tutor()
        AND (
          EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/students/' || ce.user_id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.cohorts co
            WHERE co.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/cohorts/' || co.id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND ce.cohort_id IS NOT NULL
              AND name LIKE ('lessons/%/cohorts/' || ce.cohort_id::text || '/%')
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Staff delete lesson recordings" ON storage.objects;
CREATE POLICY "Staff delete lesson recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (
      public.is_master_admin()
      OR (
        public.is_tutor()
        AND (
          EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/students/' || ce.user_id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.cohorts co
            WHERE co.tutor_id = auth.uid()
              AND name LIKE ('lessons/%/cohorts/' || co.id::text || '/%')
          )
          OR EXISTS (
            SELECT 1
            FROM public.course_enrollments ce
            WHERE ce.tutor_id = auth.uid()
              AND ce.cohort_id IS NOT NULL
              AND name LIKE ('lessons/%/cohorts/' || ce.cohort_id::text || '/%')
          )
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
