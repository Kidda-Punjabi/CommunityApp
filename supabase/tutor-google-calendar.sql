-- =============================================================================
-- Kidda — Tutor Google Calendar sync + live lesson scheduling
-- Run after tutor-cohort-access.sql and homework-submissions.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- OAuth tokens (service-role writes only — no authenticated SELECT)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tutor_google_calendar_connections (
  tutor_id              UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  google_account_email  TEXT NOT NULL,
  calendar_id           TEXT NOT NULL DEFAULT 'primary',
  access_token          TEXT NOT NULL,
  refresh_token         TEXT NOT NULL,
  token_expires_at      TIMESTAMPTZ NOT NULL,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at        TIMESTAMPTZ,
  sync_token            TEXT
);

COMMENT ON TABLE public.tutor_google_calendar_connections IS
  'Google Calendar OAuth tokens for tutors. Readable only by service role — app exposes status via RPC.';

ALTER TABLE public.tutor_google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- No policies — authenticated users cannot read tokens.

-- ---------------------------------------------------------------------------
-- Synced calendar sessions (matched to students / cohorts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tutor_scheduled_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id          UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  google_event_id   TEXT NOT NULL,
  student_id        UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  cohort_id         UUID REFERENCES public.cohorts (id) ON DELETE SET NULL,
  course_id         UUID REFERENCES public.courses (id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  meet_link         TEXT,
  location          TEXT,
  attendee_emails   TEXT[] NOT NULL DEFAULT '{}',
  match_method      TEXT CHECK (match_method IN ('attendee_email', 'title_name', 'manual', 'unmatched')),
  rescheduling_allowed BOOLEAN NOT NULL DEFAULT true,
  status            TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  google_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, google_event_id),
  CHECK (student_id IS NOT NULL OR cohort_id IS NOT NULL OR match_method = 'unmatched')
);

COMMENT ON TABLE public.tutor_scheduled_sessions IS
  'Upcoming live lessons synced from tutor Google Calendar and matched to enrolled students.';
COMMENT ON COLUMN public.tutor_scheduled_sessions.rescheduling_allowed IS
  'When false, students cannot request a reschedule (e.g. exam prep lock-in).';

CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_tutor_starts
  ON public.tutor_scheduled_sessions (tutor_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_student_starts
  ON public.tutor_scheduled_sessions (student_id, starts_at)
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_cohort_starts
  ON public.tutor_scheduled_sessions (cohort_id, starts_at)
  WHERE cohort_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Student reschedule requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_reschedule_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  preferred_times TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  tutor_response  TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

COMMENT ON TABLE public.lesson_reschedule_requests IS
  'Student-initiated reschedule requests. Tutor resolves manually in Google Calendar; app tracks status.';

CREATE INDEX IF NOT EXISTS idx_lesson_reschedule_requests_tutor_pending
  ON public.lesson_reschedule_requests (session_id, status)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tutor_owns_session(p_session_id UUID, p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tutor_scheduled_sessions s
    WHERE s.id = p_session_id AND s.tutor_id = p_tutor_id
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_view_session(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_scheduled_sessions s
    WHERE s.id = p_session_id
      AND s.status = 'scheduled'
      AND (
        s.student_id = p_user_id
        OR (
          s.cohort_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.cohort_members cm
            WHERE cm.cohort_id = s.cohort_id
              AND cm.user_id = p_user_id
              AND cm.left_at IS NULL
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.student_enrolled_with_tutor(
  p_student_id UUID,
  p_tutor_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.user_id = p_student_id AND ce.tutor_id = p_tutor_id
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: tutor_scheduled_sessions
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutor_scheduled_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors read own scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Tutors read own scheduled sessions"
  ON public.tutor_scheduled_sessions FOR SELECT TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read their scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Students read their scheduled sessions"
  ON public.tutor_scheduled_sessions FOR SELECT TO authenticated
  USING (public.student_can_view_session(id, auth.uid()));

DROP POLICY IF EXISTS "Tutors update own scheduled sessions" ON public.tutor_scheduled_sessions;
CREATE POLICY "Tutors update own scheduled sessions"
  ON public.tutor_scheduled_sessions FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

-- Inserts/deletes via service role sync only

-- ---------------------------------------------------------------------------
-- RLS: lesson_reschedule_requests
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_reschedule_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students read own reschedule requests"
  ON public.lesson_reschedule_requests FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.tutor_owns_session(session_id, auth.uid())
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Students create reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students create reschedule requests"
  ON public.lesson_reschedule_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.student_can_view_session(session_id, auth.uid())
  );

DROP POLICY IF EXISTS "Students cancel own pending requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Students cancel own pending requests"
  ON public.lesson_reschedule_requests FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS "Tutors resolve reschedule requests" ON public.lesson_reschedule_requests;
CREATE POLICY "Tutors resolve reschedule requests"
  ON public.lesson_reschedule_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND (public.tutor_owns_session(session_id, auth.uid()) OR public.is_master_admin())
  )
  WITH CHECK (
    status IN ('approved', 'denied')
    AND (public.tutor_owns_session(session_id, auth.uid()) OR public.is_master_admin())
  );

GRANT SELECT, UPDATE ON public.tutor_scheduled_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lesson_reschedule_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_owns_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_view_session(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: calendar connection status (no tokens exposed)
-- Uses profile_roles (same source as the tutor dashboard), not legacy is_tutor().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_access_tutor_dashboard(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    WHERE pr.user_id = p_user_id
      AND pr.role IN ('tutor'::public.app_role, 'master_admin'::public.app_role)
  )
  OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.get_tutor_calendar_connection_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.tutor_google_calendar_connections%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_tutor_dashboard(v_user) THEN
    RAISE EXCEPTION 'Tutor access required';
  END IF;

  SELECT * INTO v_row
  FROM public.tutor_google_calendar_connections
  WHERE tutor_id = v_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('connected', false);
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'google_account_email', v_row.google_account_email,
    'calendar_id', v_row.calendar_id,
    'connected_at', v_row.connected_at,
    'last_synced_at', v_row.last_synced_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_tutor_google_calendar()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_tutor_dashboard(v_user) THEN
    RAISE EXCEPTION 'Tutor access required';
  END IF;

  DELETE FROM public.tutor_google_calendar_connections WHERE tutor_id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_tutor_dashboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_calendar_connection_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_tutor_google_calendar() TO authenticated;

-- ---------------------------------------------------------------------------
-- Notifications: lesson_reschedule_requested / lesson_reschedule_resolved
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS lesson_scheduling BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'friend_level_up',
    'kudos',
    'announcement',
    'friend_game_challenge',
    'friend_game_challenge_result',
    'homework_reviewed',
    'lesson_reschedule_requested',
    'lesson_reschedule_resolved'
  ));

CREATE OR REPLACE FUNCTION public._create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_user_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.notification_settings%ROWTYPE;
  v_notification_id UUID;
BEGIN
  PERFORM public._ensure_notification_settings(p_user_id);
  SELECT * INTO v_settings FROM public.notification_settings WHERE user_id = p_user_id;

  IF p_type = 'friend_request' AND NOT COALESCE(v_settings.friend_requests, true) THEN
    RETURN NULL;
  ELSIF p_type = 'friend_level_up' AND NOT COALESCE(v_settings.friend_level_ups, true) THEN
    RETURN NULL;
  ELSIF p_type = 'kudos' AND NOT COALESCE(v_settings.kudos, true) THEN
    RETURN NULL;
  ELSIF p_type = 'announcement' AND NOT COALESCE(v_settings.announcements, true) THEN
    RETURN NULL;
  ELSIF p_type IN ('friend_game_challenge', 'friend_game_challenge_result')
    AND NOT COALESCE(v_settings.game_challenges, true) THEN
    RETURN NULL;
  ELSIF p_type = 'homework_reviewed' AND NOT COALESCE(v_settings.homework_reviews, true) THEN
    RETURN NULL;
  ELSIF p_type IN ('lesson_reschedule_requested', 'lesson_reschedule_resolved')
    AND NOT COALESCE(v_settings.lesson_scheduling, true) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, actor_user_id, payload)
  VALUES (p_user_id, p_type, p_actor_user_id, p_payload)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_lesson_reschedule_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
BEGIN
  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  SELECT COALESCE(preferred_name, split_part(full_name, ' ', 1), 'A student')
  INTO v_student_name
  FROM public.profiles WHERE id = NEW.student_id;

  PERFORM public._create_notification(
    v_session.tutor_id,
    'lesson_reschedule_requested',
    NEW.student_id,
    jsonb_build_object(
      'session_id', NEW.session_id,
      'request_id', NEW.id,
      'student_name', v_student_name,
      'session_title', v_session.title,
      'starts_at', v_session.starts_at
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_reschedule_requested ON public.lesson_reschedule_requests;
CREATE TRIGGER trg_lesson_reschedule_requested
  AFTER INSERT ON public.lesson_reschedule_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_lesson_reschedule_requested();

CREATE OR REPLACE FUNCTION public.notify_lesson_reschedule_resolved()
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
    'lesson_reschedule_resolved',
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

DROP TRIGGER IF EXISTS trg_lesson_reschedule_resolved ON public.lesson_reschedule_requests;
CREATE TRIGGER trg_lesson_reschedule_resolved
  AFTER UPDATE OF status ON public.lesson_reschedule_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lesson_reschedule_resolved();

NOTIFY pgrst, 'reload schema';
