-- =============================================================================
-- Migrate legacy events table → app schema
-- (Legacy: event_date, members_only from initial Kidda schema)
-- Run in Supabase SQL Editor — safe to run multiple times
-- =============================================================================

-- Columns the app expects
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS required_tier TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_freq TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Copy legacy event_date → starts_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_date'
  ) THEN
    UPDATE public.events
    SET starts_at = event_date
    WHERE starts_at IS NULL AND event_date IS NOT NULL;

    ALTER TABLE public.events ALTER COLUMN event_date DROP NOT NULL;
  END IF;
END $$;

-- Legacy members_only is no longer used (app uses is_free + required_tier)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'members_only'
  ) THEN
    ALTER TABLE public.events ALTER COLUMN members_only DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events (starts_at);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events"
  ON public.events FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated, service_role;
GRANT ALL ON public.events TO service_role;

NOTIFY pgrst, 'reload schema';
