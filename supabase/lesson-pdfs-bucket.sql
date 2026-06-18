-- Quick fix: create lesson-pdfs bucket + policies (same pattern as audio-files)
-- Run in Supabase SQL Editor if PDF upload says "Bucket not found"

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-pdfs', 'lesson-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Anyone can view lesson PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload lesson PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update lesson PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lesson PDFs" ON storage.objects;

CREATE POLICY "Anyone can view lesson PDFs"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'lesson-pdfs');

CREATE POLICY "Admins can upload lesson PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-pdfs'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update lesson PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lesson-pdfs'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete lesson PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-pdfs'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
