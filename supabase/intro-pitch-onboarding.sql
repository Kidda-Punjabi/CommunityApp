-- =============================================================================
-- Kidda — First-run intro pitch ("how to learn Punjabi properly")
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_intro_pitch BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_seen_intro_pitch IS
  'True after the user completes or skips the first-run intro pitch flow.';

-- Existing members who already finished app onboarding should not see the pitch.
UPDATE public.profiles
SET has_seen_intro_pitch = true
WHERE has_seen_onboarding = true
  AND has_seen_intro_pitch = false;

NOTIFY pgrst, 'reload schema';
