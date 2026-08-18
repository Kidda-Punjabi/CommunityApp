-- Additive email alerts for cohort switch + lesson reschedule requests.
-- Extends existing trigger functions (bindings unchanged).
-- Secret is read from vault.secrets name = internal_notify_webhook_secret.

CREATE OR REPLACE FUNCTION public.notify_cohort_switch_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
  v_from_cohort_name TEXT;
  v_to_cohort_name TEXT;
  v_admin RECORD;
  v_secret TEXT;
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_lesson_reschedule_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.tutor_scheduled_sessions%ROWTYPE;
  v_student_name TEXT;
  v_secret TEXT;
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
$function$;

NOTIFY pgrst, 'reload schema';
