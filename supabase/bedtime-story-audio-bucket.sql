-- =============================================================================
-- Kidda — Public storage bucket for Kids bedtime story TTS audio
-- Same pattern as comprehension-audio / conversation-audio / lesson-audio
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('bedtime-story-audio', 'bedtime-story-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read bedtime-story-audio" ON storage.objects;
CREATE POLICY "Public read bedtime-story-audio"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'bedtime-story-audio');

DROP POLICY IF EXISTS "Admins insert bedtime-story-audio" ON storage.objects;
CREATE POLICY "Admins insert bedtime-story-audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bedtime-story-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update bedtime-story-audio" ON storage.objects;
CREATE POLICY "Admins update bedtime-story-audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'bedtime-story-audio' AND public.is_admin())
  WITH CHECK (bucket_id = 'bedtime-story-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete bedtime-story-audio" ON storage.objects;
CREATE POLICY "Admins delete bedtime-story-audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'bedtime-story-audio' AND public.is_admin());
