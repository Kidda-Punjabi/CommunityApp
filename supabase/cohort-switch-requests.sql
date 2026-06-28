-- Cohort switch requests: students in group lessons can ask to join another cohort's
-- session (e.g. a different Punjabi group time). Tutor resolves manually.
-- Run after tutor-google-calendar.sql and tutor-cohort-access.sql.

CREATE TABLE IF NOT EXISTS public.cohort_switch_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  from_cohort_id  UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  to_cohort_id    UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  tutor_response  TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id),
  CHECK (from_cohort_id <> to_cohort_id)
);

COMMENT ON TABLE public.cohort_switch_requests IS
  'Student requests to attend a group lesson with a different cohort. Tutor resolves manually.';

CREATE INDEX IF NOT EXISTS idx_cohort_switch_requests_pending
  ON public.cohort_switch_requests (session_id, status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_switch_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students read own cohort switch requests"
  ON public.cohort_switch_requests FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.tutor_owns_session(session_id, auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Students create cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students create cohort switch requests"
  ON public.cohort_switch_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.student_can_view_session(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "Students cancel own pending cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Students cancel own pending cohort switch requests"
  ON public.cohort_switch_requests FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS "Tutors resolve cohort switch requests" ON public.cohort_switch_requests;
CREATE POLICY "Tutors resolve cohort switch requests"
  ON public.cohort_switch_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND (public.tutor_owns_session(session_id, auth.uid()) OR public.is_master_admin())
  )
  WITH CHECK (
    status IN ('approved', 'denied')
    AND (public.tutor_owns_session(session_id, auth.uid()) OR public.is_master_admin())
  );

GRANT SELECT, INSERT, UPDATE ON public.cohort_switch_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
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
BEGIN
  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  SELECT COALESCE(preferred_name, split_part(full_name, ' ', 1), 'A student')
  INTO v_student_name
  FROM public.profiles WHERE id = NEW.student_id;

  SELECT name INTO v_to_cohort_name
  FROM public.cohorts WHERE id = NEW.to_cohort_id;

  PERFORM public._create_notification(
    v_session.tutor_id,
    'cohort_switch_requested',
    NEW.student_id,
    jsonb_build_object(
      'session_id', NEW.session_id,
      'request_id', NEW.id,
      'student_name', v_student_name,
      'session_title', v_session.title,
      'starts_at', v_session.starts_at,
      'to_cohort_name', v_to_cohort_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohort_switch_requested ON public.cohort_switch_requests;
CREATE TRIGGER trg_cohort_switch_requested
  AFTER INSERT ON public.cohort_switch_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_cohort_switch_requested();

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
BEGIN
  IF NEW.status NOT IN ('approved', 'denied') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  PERFORM public._create_notification(
    NEW.student_id,
    'cohort_switch_resolved',
    v_session.tutor_id,
    jsonb_build_object(
      'session_id', NEW.session_id,
      'request_id', NEW.id,
      'status', NEW.status,
      'tutor_response', NEW.tutor_response,
      'session_title', v_session.title,
      'starts_at', v_session.starts_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohort_switch_resolved ON public.cohort_switch_requests;
CREATE TRIGGER trg_cohort_switch_resolved
  AFTER UPDATE OF status ON public.cohort_switch_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_cohort_switch_resolved();

NOTIFY pgrst, 'reload schema';
