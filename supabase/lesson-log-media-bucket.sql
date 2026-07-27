-- Lesson log media: recordings, slides, flashcards uploaded from admin Lesson Log.
-- Public bucket — URLs are stored on cohort_lesson_log_entries.*_url columns.
-- Prefer ensureStorageBuckets (service role) in admin; this SQL is a fallback.
-- Do not set file_size_limit via API above ~50MB on this project (rejected).
-- Leave null so large Zoom/Meet exports can upload; client soft-caps at 500MB.

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-log-media', 'lesson-log-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Anyone can view lesson log media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload lesson log media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update lesson log media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lesson log media" ON storage.objects;

CREATE POLICY "Anyone can view lesson log media"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'lesson-log-media');

CREATE POLICY "Admins can upload lesson log media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-log-media'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update lesson log media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lesson-log-media'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete lesson log media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-log-media'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
