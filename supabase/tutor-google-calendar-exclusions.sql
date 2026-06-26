-- =============================================================================
-- Kidda — Tutor calendar exclusions (mark events / series as not a lesson)
-- Run after tutor-google-calendar.sql
-- =============================================================================

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS google_recurring_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_recurring
  ON public.tutor_scheduled_sessions (tutor_id, google_recurring_event_id)
  WHERE google_recurring_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tutor_calendar_event_exclusions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id              UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  google_event_id       TEXT,
  google_recurring_event_id TEXT,
  title                 TEXT,
  scope                 TEXT NOT NULL CHECK (scope IN ('event', 'series')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    google_event_id IS NOT NULL
    OR google_recurring_event_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS tutor_calendar_exclusions_event_uq
  ON public.tutor_calendar_event_exclusions (tutor_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tutor_calendar_exclusions_series_uq
  ON public.tutor_calendar_event_exclusions (tutor_id, google_recurring_event_id)
  WHERE google_recurring_event_id IS NOT NULL;

COMMENT ON TABLE public.tutor_calendar_event_exclusions IS
  'Calendar events or recurring series the tutor marked as not a Kidda lesson. Skipped on sync.';

ALTER TABLE public.tutor_calendar_event_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors manage own calendar exclusions" ON public.tutor_calendar_event_exclusions;
CREATE POLICY "Tutors manage own calendar exclusions"
  ON public.tutor_calendar_event_exclusions FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

GRANT SELECT, INSERT, DELETE ON public.tutor_calendar_event_exclusions TO authenticated;
