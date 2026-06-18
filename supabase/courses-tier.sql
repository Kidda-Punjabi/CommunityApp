-- Add course tier for Stripe / lesson access gating
-- Run in Supabase SQL Editor

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS required_tier TEXT NOT NULL DEFAULT 'foundational';

-- Map existing courses by name (edit if your course names differ)
UPDATE public.courses
SET required_tier = 'foundational'
WHERE name ILIKE '%foundational%';

UPDATE public.courses
SET required_tier = 'beginners'
WHERE name ILIKE '%beginner%';

UPDATE public.courses
SET required_tier = 'community'
WHERE name ILIKE '%community%';

NOTIFY pgrst, 'reload schema';
