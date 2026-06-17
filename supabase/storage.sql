-- =============================================================================
-- Kidda — Supabase Storage buckets & policies
-- Run in the Supabase SQL Editor after creating tables.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('audio-files', 'audio-files', true),
  ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

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
