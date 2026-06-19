-- =============================================================================
-- Kidda — Onboarding flags + progression profile fields
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_assessed_starting_tier INTEGER
    CHECK (self_assessed_starting_tier IS NULL OR self_assessed_starting_tier BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS stated_goal_motivation TEXT,
  ADD COLUMN IF NOT EXISTS target_tier INTEGER
    CHECK (target_tier IS NULL OR target_tier BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS peak_competency_score INTEGER NOT NULL DEFAULT 0
    CHECK (peak_competency_score BETWEEN 0 AND 100);

COMMENT ON COLUMN public.profiles.has_seen_onboarding IS
  'True after the user completes or dismisses the first-run onboarding tutorial.';
COMMENT ON COLUMN public.profiles.self_assessed_starting_tier IS
  'Onboarding self-assessment tier (1-8). Used only until real activity evidence exists.';
COMMENT ON COLUMN public.profiles.stated_goal_motivation IS
  'Onboarding goal motivation key (e.g. talk_to_family).';
COMMENT ON COLUMN public.profiles.target_tier IS
  'Onboarding target tier (1-8).';
COMMENT ON COLUMN public.profiles.peak_competency_score IS
  'Ratcheted competency score (0-100); never decreases in v1.';

NOTIFY pgrst, 'reload schema';
