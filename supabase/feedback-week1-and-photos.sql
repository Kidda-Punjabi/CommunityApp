-- =============================================================================
-- Kidda — Week 1 baseline survey + Week 12 testimonial photos
-- Run in Supabase SQL Editor
-- =============================================================================

-- Allow week1 alongside existing session / week12 / community variants.
ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_form_variant_check;

ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_form_variant_check
  CHECK (form_variant IN ('standard', 'week12', 'community', 'week1'));

-- Week 1 baseline does not collect session ratings.
ALTER TABLE public.feedback_submissions
  ALTER COLUMN learning_relevance DROP NOT NULL,
  ALTER COLUMN tutor_effectiveness DROP NOT NULL,
  ALTER COLUMN confidence DROP NOT NULL;

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_learning_relevance_check;
ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_learning_relevance_check
  CHECK (learning_relevance IS NULL OR (learning_relevance >= 1 AND learning_relevance <= 5));

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_tutor_effectiveness_check;
ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_tutor_effectiveness_check
  CHECK (tutor_effectiveness IS NULL OR (tutor_effectiveness >= 1 AND tutor_effectiveness <= 5));

ALTER TABLE public.feedback_submissions
  DROP CONSTRAINT IF EXISTS feedback_submissions_confidence_check;
ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_confidence_check
  CHECK (confidence IS NULL OR (confidence >= 1 AND confidence <= 5));

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS picture_url TEXT;

COMMENT ON COLUMN public.feedback_submissions.picture_url IS
  'Public Supabase Storage URL for an optional Week 12 testimonial photo.';

-- Public bucket so Notion can fetch the image as an external file URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-photos', 'feedback-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Anyone can view feedback photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own feedback photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own feedback photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own feedback photos" ON storage.objects;

CREATE POLICY "Anyone can view feedback photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'feedback-photos');

CREATE POLICY "Users can upload own feedback photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own feedback photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'feedback-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'feedback-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own feedback photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
