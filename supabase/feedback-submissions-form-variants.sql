-- =============================================================================
-- Kidda — feedback_submissions: standard vs week12 form variants
-- Run if you already applied an earlier version of feedback-submissions.sql
-- =============================================================================

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS form_variant TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_form_variant_check;

ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_form_variant_check
  CHECK (form_variant IN ('standard', 'week12'));

-- Make week-12-only columns nullable
ALTER TABLE public.feedback_submissions
  ALTER COLUMN understanding DROP NOT NULL,
  ALTER COLUMN speaking DROP NOT NULL,
  ALTER COLUMN understanding_grammar DROP NOT NULL,
  ALTER COLUMN clarity_structure DROP NOT NULL,
  ALTER COLUMN concept_breakdown DROP NOT NULL,
  ALTER COLUMN supportiveness DROP NOT NULL,
  ALTER COLUMN overall_score DROP NOT NULL,
  ALTER COLUMN recommend DROP NOT NULL,
  ALTER COLUMN video_testimonial DROP NOT NULL;

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_recommend_check;

ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_recommend_check
  CHECK (recommend IS NULL OR recommend IN ('Yes', 'No'));

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_video_testimonial_check;

ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_video_testimonial_check
  CHECK (video_testimonial IS NULL OR video_testimonial IN ('Yes', 'No'));

NOTIFY pgrst, 'reload schema';
