-- Cohort switch requests: admin-only resolution (not tutors).
-- Also notify master admins instead of the source-session tutor.

-- ---------------------------------------------------------------------------
-- RLS: only master admins may resolve (approve/deny)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tutors resolve cohort switch requests" ON public.cohort_switch_requests;
DROP POLICY IF EXISTS "Admins resolve cohort switch requests" ON public.cohort_switch_requests;

CREATE POLICY "Admins resolve cohort switch requests"
  ON public.cohort_switch_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND public.is_master_admin()
  )
  WITH CHECK (
    status IN ('approved', 'denied')
    AND public.is_master_admin()
  );

-- ---------------------------------------------------------------------------
-- Notifications: admin reviews via Admin Home → Cohort change requests (no learner feed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
