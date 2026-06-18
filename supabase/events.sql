-- =============================================================================
-- Kidda — Events table
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  meeting_url TEXT,
  external_url TEXT,
  required_tier TEXT CHECK (required_tier IN ('foundational', 'beginners', 'community')),
  is_free BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  recurrence_freq TEXT CHECK (recurrence_freq IN ('weekly', 'biweekly', 'monthly')),
  recurrence_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
