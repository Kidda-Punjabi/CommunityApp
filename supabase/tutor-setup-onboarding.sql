-- =============================================================================
-- Kidda — Tutor first-time setup (bio + one-time completion flag)
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutor_bio TEXT,
  ADD COLUMN IF NOT EXISTS has_completed_tutor_setup BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.tutor_bio IS
  'Short personal bio shown to students (interests outside teaching, etc.).';
COMMENT ON COLUMN public.profiles.has_completed_tutor_setup IS
  'True after the tutor completes the first-time setup checklist; never resets.';

NOTIFY pgrst, 'reload schema';
