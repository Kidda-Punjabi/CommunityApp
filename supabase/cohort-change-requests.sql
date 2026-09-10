-- Course/level change requests (e.g. Beginners -> Intermediate).
-- Admin paper trail only: no student self-serve, no payment, no enrollment move.
-- Distinct from cohort_switch_requests (same-course group-slot swap).
-- Run in Supabase SQL Editor, or: node --import tsx --env-file=.env.local scripts/apply-cohort-change-requests.ts

CREATE TABLE IF NOT EXISTS public.cohort_change_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_enrollment_id   UUID REFERENCES public.course_enrollments (id) ON DELETE SET NULL,
  from_course_id         UUID REFERENCES public.courses (id) ON DELETE RESTRICT,
  to_course_id           UUID REFERENCES public.courses (id) ON DELETE RESTRICT,
  reason                 TEXT,
  fee_amount             NUMERIC,
  fee_status             TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (fee_status IN ('unpaid', 'paid', 'waived')),
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  admin_notes            TEXT,
  resolved_by            UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cohort_change_requests_from_to_distinct
    CHECK (from_course_id <> to_course_id)
);

COMMENT ON TABLE public.cohort_change_requests IS
  'Admin log of genuine course/level switches (e.g. Beginners to Intermediate). Does not move enrollments or collect fees. Distinct from cohort_switch_requests (group session slot swap).';

CREATE INDEX IF NOT EXISTS idx_cohort_change_requests_student_id
  ON public.cohort_change_requests (student_id);

CREATE INDEX IF NOT EXISTS idx_cohort_change_requests_status
  ON public.cohort_change_requests (status);

-- ---------------------------------------------------------------------------
-- RLS — admin only (no student-facing flow)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage cohort change requests" ON public.cohort_change_requests;
CREATE POLICY "Admins manage cohort change requests"
  ON public.cohort_change_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin())
  WITH CHECK (public.is_admin() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE ON public.cohort_change_requests TO authenticated;

NOTIFY pgrst, 'reload schema';
