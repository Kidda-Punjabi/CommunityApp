-- Session switch: one-off attendance at another cohort's equivalent class.
-- Reuses cohort_switch_requests (not a permanent cohort move).
-- Trigger fires on pending → approved and POSTs to the internal calendar-sync route.
-- Secret is read from vault.secrets name = internal_session_switch_webhook_secret.

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS session_switches_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.course_enrollments
  DROP CONSTRAINT IF EXISTS course_enrollments_session_switches_used_nonnegative;

ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_session_switches_used_nonnegative
  CHECK (session_switches_used >= 0);

COMMENT ON COLUMN public.course_enrollments.session_switches_used IS
  'Lifetime count of successful session switches (one-off class swaps) for this enrollment. Cap is 2. Distinct from extra_reschedule_allowance.';

ALTER TABLE public.cohort_switch_requests
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

ALTER TABLE public.cohort_switch_requests
  ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.cohort_switch_requests.sync_error IS
  'Visible Calendar / enrollment sync failure after admin approval. Null when idle or after a successful sync.';

COMMENT ON COLUMN public.cohort_switch_requests.calendar_synced_at IS
  'Set only after both Google Calendar attendee updates succeed. Student confirmation depends on this, not status alone.';

CREATE OR REPLACE FUNCTION public.notify_session_switch_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'internal_session_switch_webhook_secret'
    LIMIT 1;

    IF v_secret IS NOT NULL AND length(btrim(v_secret)) > 0 THEN
      PERFORM net.http_post(
        url := 'https://webapp.kidda.app/api/internal/session-switch-approved',
        body := jsonb_build_object(
          'request_id', NEW.id
        ),
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-session-switch-secret', v_secret
        ),
        timeout_milliseconds := 10000
      );
    ELSE
      RAISE WARNING 'notify_session_switch_approved: missing vault secret internal_session_switch_webhook_secret';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_session_switch_approved webhook failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_session_switch_approved ON public.cohort_switch_requests;
CREATE TRIGGER trg_session_switch_approved
  AFTER UPDATE OF status ON public.cohort_switch_requests
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'approved')
  EXECUTE FUNCTION public.notify_session_switch_approved();

NOTIFY pgrst, 'reload schema';
