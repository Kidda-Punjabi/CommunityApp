-- =============================================================================
-- Kidda — Generated lesson audio (ElevenLabs TTS + review workflow)
-- Run in Supabase SQL Editor.
-- =============================================================================

-- Review status on lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS audio_script TEXT,
  ADD COLUMN IF NOT EXISTS generated_audio_status TEXT NOT NULL DEFAULT 'none'
    CHECK (generated_audio_status IN ('none', 'pending_review', 'approved', 'needs_changes')),
  ADD COLUMN IF NOT EXISTS pending_audio_path TEXT;

COMMENT ON COLUMN public.lessons.audio_script IS
  'Punjabi text read aloud by ElevenLabs TTS. Edit before generating or regenerating.';
COMMENT ON COLUMN public.lessons.generated_audio_status IS
  'none | pending_review | approved | needs_changes — learners only hear approved audio_url.';
COMMENT ON COLUMN public.lessons.pending_audio_path IS
  'Path in lesson-audio bucket for the clip awaiting review (not live until approved).';

-- History of every generation attempt (approved and rejected clips stay here)
CREATE TABLE IF NOT EXISTS public.lesson_audio_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  script_text TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS lesson_audio_generations_lesson_id_idx
  ON public.lesson_audio_generations (lesson_id, created_at DESC);

ALTER TABLE public.lesson_audio_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage lesson audio generations" ON public.lesson_audio_generations;
CREATE POLICY "Admins manage lesson audio generations"
  ON public.lesson_audio_generations
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Public read lesson audio generations" ON public.lesson_audio_generations;
CREATE POLICY "Public read lesson audio generations"
  ON public.lesson_audio_generations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Storage bucket: lesson-audio (public URLs for playback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-audio', 'lesson-audio', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Anyone can view lesson audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload lesson audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update lesson audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete lesson audio" ON storage.objects;

CREATE POLICY "Anyone can view lesson audio"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'lesson-audio');

CREATE POLICY "Admins can upload lesson audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-audio'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update lesson audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lesson-audio'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can delete lesson audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-audio'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
