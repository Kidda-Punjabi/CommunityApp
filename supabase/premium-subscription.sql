-- =============================================================================
-- Kidda — Premium subscription + Kids bedtime stories
-- Run in Supabase SQL Editor (project pztubczhqkzcwtkstpgi)
-- =============================================================================

-- profiles.membership_tier already supports free / basic / premium (confirmed live).
-- memberships table already exists for Stripe subscription rows.
-- Do NOT alter course_access / Foundational / Beginners.

-- ---------------------------------------------------------------------------
-- Kid bedtime stories (premium layer; gate on PARENT profiles.membership_tier)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kid_bedtime_stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  audio_asset_id  UUID REFERENCES public.audio_assets (id) ON DELETE SET NULL,
  age_tier        TEXT NOT NULL
    CHECK (age_tier IN ('pre_reader', 'early_reader', 'independent', 'all')),
  is_premium      BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kid_bedtime_stories_display
  ON public.kid_bedtime_stories (display_order, created_at);

COMMENT ON TABLE public.kid_bedtime_stories IS
  'Kids Mode bedtime stories. Access is gated on the parent profiles.membership_tier, not kid_profiles.';

COMMENT ON COLUMN public.kid_bedtime_stories.is_premium IS
  'false = free taste for all parents; true = requires parent Premium membership.';

ALTER TABLE public.kid_bedtime_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read kid bedtime stories" ON public.kid_bedtime_stories;
CREATE POLICY "Authenticated can read kid bedtime stories"
  ON public.kid_bedtime_stories FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.kid_bedtime_stories TO authenticated;
GRANT ALL ON public.kid_bedtime_stories TO service_role;

NOTIFY pgrst, 'reload schema';
