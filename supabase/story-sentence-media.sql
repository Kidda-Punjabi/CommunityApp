-- =============================================================================
-- Kidda — Per-sentence bedtime story media (images + audio clips)
-- Run in Supabase SQL Editor before generating media.
-- Does NOT touch kid_bedtime_stories.audio_asset_id (full-story audio stays).
-- =============================================================================

ALTER TABLE public.story_sentences
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

COMMENT ON COLUMN public.story_sentences.audio_url IS
  'Public URL for this sentence''s ElevenLabs clip (story-sentence-audio bucket).';
COMMENT ON COLUMN public.story_sentences.audio_duration_ms IS
  'Duration of the sentence audio clip in milliseconds.';
COMMENT ON COLUMN public.story_sentences.audio_start_ms IS
  'Legacy slice field — unused when audio is per-sentence.';
COMMENT ON COLUMN public.story_sentences.audio_end_ms IS
  'Legacy slice field — unused when audio is per-sentence.';

-- Buckets may already exist via service-role createBucket; ensure public + policies.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('story-scene-images', 'story-scene-images', true),
  ('story-sentence-audio', 'story-sentence-audio', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- story-scene-images
DROP POLICY IF EXISTS "Public read story-scene-images" ON storage.objects;
CREATE POLICY "Public read story-scene-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'story-scene-images');

DROP POLICY IF EXISTS "Admins insert story-scene-images" ON storage.objects;
CREATE POLICY "Admins insert story-scene-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'story-scene-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update story-scene-images" ON storage.objects;
CREATE POLICY "Admins update story-scene-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'story-scene-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'story-scene-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete story-scene-images" ON storage.objects;
CREATE POLICY "Admins delete story-scene-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'story-scene-images' AND public.is_admin());

-- story-sentence-audio
DROP POLICY IF EXISTS "Public read story-sentence-audio" ON storage.objects;
CREATE POLICY "Public read story-sentence-audio"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'story-sentence-audio');

DROP POLICY IF EXISTS "Admins insert story-sentence-audio" ON storage.objects;
CREATE POLICY "Admins insert story-sentence-audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'story-sentence-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update story-sentence-audio" ON storage.objects;
CREATE POLICY "Admins update story-sentence-audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'story-sentence-audio' AND public.is_admin())
  WITH CHECK (bucket_id = 'story-sentence-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete story-sentence-audio" ON storage.objects;
CREATE POLICY "Admins delete story-sentence-audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'story-sentence-audio' AND public.is_admin());
