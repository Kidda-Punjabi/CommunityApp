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
-- Notifications: alert master admins on new requests
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
  v_to_cohort_name TEXT;
  v_admin RECORD;
BEGIN
  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  SELECT COALESCE(preferred_name, split_part(full_name, ' ', 1), 'A student')
  INTO v_student_name
  FROM public.profiles WHERE id = NEW.student_id;

  SELECT name INTO v_to_cohort_name
  FROM public.cohorts WHERE id = NEW.to_cohort_id;

  FOR v_admin IN
    SELECT user_id
    FROM public.profile_roles
    WHERE role = 'master_admin'
  LOOP
    PERFORM public._create_notification(
      v_admin.user_id,
      'cohort_switch_requested',
      NEW.student_id,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'request_id', NEW.id,
        'student_name', v_student_name,
        'session_title', v_session.title,
        'starts_at', v_session.starts_at,
        'to_cohort_name', v_to_cohort_name,
        'admin_href', '/admin/cohort-switch-requests'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
