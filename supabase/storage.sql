-- =============================================================================
-- Kidda — Supabase Storage buckets & policies
-- Run this entire script in the Supabase SQL Editor.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('audio-files', 'audio-files', true),
  ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop existing policies so this script can be re-run safely
DROP POLICY IF EXISTS "Anyone can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update audio files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete audio files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete profile photos" ON storage.objects;

-- Public read access for everyone
CREATE POLICY "Anyone can view audio files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'audio-files');

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'profile-photos');

-- Admin upload / manage
CREATE POLICY "Admins can upload audio files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update audio files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete audio files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio-files'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
