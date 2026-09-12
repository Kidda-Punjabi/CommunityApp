-- Thread kid_profile_id into cohort-switch / reschedule / cover events.
-- Adult-only events keep existing recipients (admin/tutor/student).
-- Kid-linked events add XOR dual-insert via _notify_student_event (parent + kid).

CREATE OR REPLACE FUNCTION public.resolve_kid_profile_id_for_student(
  p_student_id UUID,
  p_cohort_id UUID DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid UUID;
BEGIN
  IF p_student_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_cohort_id IS NOT NULL THEN
    SELECT cm.kid_profile_id
    INTO v_kid
    FROM public.cohort_members cm
    JOIN public.kid_profiles kp ON kp.id = cm.kid_profile_id
    WHERE cm.cohort_id = p_cohort_id
      AND cm.left_at IS NULL
      AND cm.kid_profile_id IS NOT NULL
      AND kp.parent_user_id = p_student_id
    ORDER BY cm.joined_at DESC
    LIMIT 1;

    IF v_kid IS NOT NULL THEN
      RETURN v_kid;
    END IF;

    SELECT ce.kid_profile_id
    INTO v_kid
    FROM public.course_enrollments ce
    JOIN public.kid_profiles kp ON kp.id = ce.kid_profile_id
    WHERE ce.cohort_id = p_cohort_id
      AND ce.kid_profile_id IS NOT NULL
      AND kp.parent_user_id = p_student_id
    ORDER BY ce.created_at DESC
    LIMIT 1;

    IF v_kid IS NOT NULL THEN
      RETURN v_kid;
    END IF;
  END IF;

  IF p_course_id IS NOT NULL THEN
    SELECT ce.kid_profile_id
    INTO v_kid
    FROM public.course_enrollments ce
    JOIN public.kid_profiles kp ON kp.id = ce.kid_profile_id
    WHERE ce.course_id = p_course_id
      AND ce.kid_profile_id IS NOT NULL
      AND kp.parent_user_id = p_student_id
    ORDER BY ce.created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_kid;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_student_event_as_staff(
  p_user_id UUID,
  p_kid_profile_id UUID,
  p_type TEXT,
  p_actor_user_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin/tutor server actions call this via the service-role client after
  -- checking access in app code. JWT sessions still require staff.
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT (
      public.is_master_admin()
      OR public.user_can_access_tutor_dashboard(auth.uid())
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  PERFORM public._notify_student_event(
    p_user_id,
    p_kid_profile_id,
    p_type,
    p_actor_user_id,
    COALESCE(p_payload, '{}'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_session_kids_of_cover(
  p_session_id UUID,
  p_actor_user_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_kid UUID;
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT (
      public.is_master_admin()
      OR public.user_can_access_tutor_dashboard(auth.uid())
    ) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN;
  END IF;

  -- Kids in the group cohort only. Adult members (user_id, no kid) stay unchanged.
  IF v_session.cohort_id IS NOT NULL THEN
    FOR v_kid IN
      SELECT DISTINCT cm.kid_profile_id
      FROM public.cohort_members cm
      WHERE cm.cohort_id = v_session.cohort_id
        AND cm.left_at IS NULL
        AND cm.kid_profile_id IS NOT NULL
    LOOP
      PERFORM public._notify_student_event(
        NULL,
        v_kid,
        'tutor_cover_assigned',
        p_actor_user_id,
        COALESCE(p_payload, '{}'::JSONB)
      );
    END LOOP;
  ELSIF v_session.student_id IS NOT NULL THEN
    v_kid := public.resolve_kid_profile_id_for_student(
      v_session.student_id,
      NULL,
      v_session.course_id
    );
    IF v_kid IS NOT NULL THEN
      PERFORM public._notify_student_event(
        NULL,
        v_kid,
        'tutor_cover_assigned',
        p_actor_user_id,
        COALESCE(p_payload, '{}'::JSONB)
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
  v_from_cohort_name TEXT;
  v_to_cohort_name TEXT;
  v_admin RECORD;
  v_secret TEXT;
  v_kid UUID;
BEGIN
  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  SELECT COALESCE(preferred_name, split_part(full_name, ' ', 1), 'A student')
  INTO v_student_name
  FROM public.profiles WHERE id = NEW.student_id;

  SELECT name INTO v_from_cohort_name
  FROM public.cohorts WHERE id = NEW.from_cohort_id;

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

  v_kid := public.resolve_kid_profile_id_for_student(
    NEW.student_id,
    NEW.from_cohort_id,
    v_session.course_id
  );
  IF v_kid IS NOT NULL THEN
    PERFORM public._notify_student_event(
      NEW.student_id,
      v_kid,
      'cohort_switch_requested',
      NEW.student_id,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'request_id', NEW.id,
        'session_title', v_session.title,
        'starts_at', v_session.starts_at,
        'to_cohort_name', v_to_cohort_name
      )
    );
  END IF;

  BEGIN
    SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'internal_notify_webhook_secret'
    LIMIT 1;

    IF v_secret IS NOT NULL AND length(btrim(v_secret)) > 0 THEN
      PERFORM net.http_post(
        url := 'https://webapp.kidda.app/api/internal/notify-request',
        body := jsonb_build_object(
          'type', 'cohort_switch',
          'request_id', NEW.id,
          'student_name', v_student_name,
          'session_title', v_session.title,
          'starts_at', v_session.starts_at,
          'from_cohort_name', v_from_cohort_name,
          'to_cohort_name', v_to_cohort_name,
          'message', NEW.message,
          'created_at', NEW.created_at
        ),
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-notify-secret', v_secret
        ),
        timeout_milliseconds := 10000
      );
    ELSE
      RAISE WARNING 'notify_cohort_switch_requested: missing vault secret internal_notify_webhook_secret';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_cohort_switch_requested email failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_kid UUID;
BEGIN
  IF NEW.status NOT IN ('approved', 'denied') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  v_kid := public.resolve_kid_profile_id_for_student(
    NEW.student_id,
    NEW.from_cohort_id,
    v_session.course_id
  );

  PERFORM public._notify_student_event(
    NEW.student_id,
    v_kid,
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

CREATE OR REPLACE FUNCTION public.notify_lesson_reschedule_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
  v_secret TEXT;
  v_kid UUID;
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

  v_kid := public.resolve_kid_profile_id_for_student(
    NEW.student_id,
    v_session.cohort_id,
    v_session.course_id
  );
  IF v_kid IS NOT NULL THEN
    PERFORM public._notify_student_event(
      NEW.student_id,
      v_kid,
      'lesson_reschedule_requested',
      NEW.student_id,
      jsonb_build_object(
        'session_id', NEW.session_id,
        'request_id', NEW.id,
        'session_title', v_session.title,
        'starts_at', v_session.starts_at
      )
    );
  END IF;

  BEGIN
    SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'internal_notify_webhook_secret'
    LIMIT 1;

    IF v_secret IS NOT NULL AND length(btrim(v_secret)) > 0 THEN
      PERFORM net.http_post(
        url := 'https://webapp.kidda.app/api/internal/notify-request',
        body := jsonb_build_object(
          'type', 'lesson_reschedule',
          'request_id', NEW.id,
          'student_name', v_student_name,
          'session_title', v_session.title,
          'starts_at', v_session.starts_at,
          'message', NEW.message,
          'preferred_times', NEW.preferred_times,
          'created_at', NEW.created_at
        ),
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-notify-secret', v_secret
        ),
        timeout_milliseconds := 10000
      );
    ELSE
      RAISE WARNING 'notify_lesson_reschedule_requested: missing vault secret internal_notify_webhook_secret';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_lesson_reschedule_requested email failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_lesson_reschedule_resolved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_kid UUID;
BEGIN
  IF NEW.status NOT IN ('approved', 'denied') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_session
  FROM public.tutor_scheduled_sessions
  WHERE id = NEW.session_id;

  v_kid := public.resolve_kid_profile_id_for_student(
    NEW.student_id,
    v_session.cohort_id,
    v_session.course_id
  );

  PERFORM public._notify_student_event(
    NEW.student_id,
    v_kid,
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

REVOKE ALL ON FUNCTION public.resolve_kid_profile_id_for_student(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_kid_profile_id_for_student(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_student_event_as_staff(UUID, UUID, TEXT, UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_session_kids_of_cover(UUID, UUID, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
