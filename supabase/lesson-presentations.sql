-- =============================================================================
-- Kidda — External presentation links on lessons (Google Slides, Canva, etc.)
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS presentation_url TEXT;

COMMENT ON COLUMN public.lessons.presentation_url IS
  'External URL to the lesson presentation (e.g. Google Slides). Not counted toward lesson completion.';

NOTIFY pgrst, 'reload schema';
