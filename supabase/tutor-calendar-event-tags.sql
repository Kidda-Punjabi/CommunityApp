-- =============================================================================
-- Kidda — Tutor calendar event tags (opt-in Kidda meeting / admin / prep)
--
-- Unmatched calendar events do not count toward tutor hours unless tagged.
-- Personal time stays untagged (or excluded via tutor_calendar_event_exclusions).
-- Going-forward only — do not backfill.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_calendar_event_tags (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id                   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  google_event_id            TEXT,
  google_recurring_event_id  TEXT,
  title                      TEXT,
  scope                      TEXT NOT NULL CHECK (scope IN ('event', 'series')),
  category                   TEXT NOT NULL CHECK (category IN ('kidda_meeting', 'kidda_admin', 'kidda_prep')),
  tagged_by                  UUID NOT NULL REFERENCES public.profiles (id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    google_event_id IS NOT NULL
    OR google_recurring_event_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS tutor_calendar_event_tags_identity_uq
  ON public.tutor_calendar_event_tags (
    tutor_id,
    COALESCE(google_event_id, ''),
    COALESCE(google_recurring_event_id, '')
  );

CREATE INDEX IF NOT EXISTS idx_tutor_calendar_event_tags_tutor
  ON public.tutor_calendar_event_tags (tutor_id);

CREATE INDEX IF NOT EXISTS idx_tutor_calendar_event_tags_event
  ON public.tutor_calendar_event_tags (tutor_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutor_calendar_event_tags_series
  ON public.tutor_calendar_event_tags (tutor_id, google_recurring_event_id)
  WHERE google_recurring_event_id IS NOT NULL;

COMMENT ON TABLE public.tutor_calendar_event_tags IS
  'Opt-in Kidda meeting/admin/prep tags for unmatched calendar events. Untagged events are excluded from tutor hours. Not a payroll record.';

ALTER TABLE public.tutor_calendar_event_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors select own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors select own calendar event tags"
  ON public.tutor_calendar_event_tags FOR SELECT TO authenticated
  USING (tutor_id = auth.uid() AND public.is_tutor());

DROP POLICY IF EXISTS "Master admins select calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Master admins select calendar event tags"
  ON public.tutor_calendar_event_tags FOR SELECT TO authenticated
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "Tutors insert own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors insert own calendar event tags"
  ON public.tutor_calendar_event_tags FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = auth.uid()
    AND tagged_by = auth.uid()
    AND public.is_tutor()
  );

DROP POLICY IF EXISTS "Tutors delete own calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Tutors delete own calendar event tags"
  ON public.tutor_calendar_event_tags FOR DELETE TO authenticated
  USING (tutor_id = auth.uid() AND public.is_tutor());

GRANT SELECT, INSERT, DELETE ON public.tutor_calendar_event_tags TO authenticated;
GRANT ALL ON public.tutor_calendar_event_tags TO service_role;

NOTIFY pgrst, 'reload schema';
