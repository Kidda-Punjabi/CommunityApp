-- =============================================================================
-- Kidda — calendar sync status for 1-to-1 Google Calendar cancel follow-up
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS calendar_sync_status text,
  ADD COLUMN IF NOT EXISTS calendar_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutor_scheduled_sessions_calendar_sync_status_check'
  ) THEN
    ALTER TABLE public.tutor_scheduled_sessions
      ADD CONSTRAINT tutor_scheduled_sessions_calendar_sync_status_check
      CHECK (
        calendar_sync_status IS NULL
        OR calendar_sync_status IN ('pending', 'dry_run_logged', 'cancelled', 'error')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.tutor_scheduled_sessions.calendar_sync_status IS
  'Google Calendar cancel follow-up for 1-to-1 booking cancels: pending / dry_run_logged / cancelled / error. Independent of session.status.';

COMMENT ON COLUMN public.tutor_scheduled_sessions.calendar_sync_error IS
  'Last calendar cancel follow-up error message (or dry-run payload summary). Cleared on success.';

CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_calendar_sync_status
  ON public.tutor_scheduled_sessions (calendar_sync_status)
  WHERE calendar_sync_status IS NOT NULL;

NOTIFY pgrst, 'reload schema';
