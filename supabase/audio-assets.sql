-- =============================================================================
-- Kidda — Generic audio assets (ElevenLabs TTS + review workflow)
-- Run in Supabase SQL Editor after lesson-generated-audio.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  script_text TEXT,
  storage_path TEXT,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'pending_review', 'approved', 'needs_changes')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audio_assets_content_unique UNIQUE (content_type, content_id)
);

CREATE INDEX IF NOT EXISTS audio_assets_status_idx
  ON public.audio_assets (status)
  WHERE status IN ('pending_review', 'needs_changes');

CREATE INDEX IF NOT EXISTS audio_assets_content_idx
  ON public.audio_assets (content_type, content_id);

COMMENT ON TABLE public.audio_assets IS
  'One row per voicable content item (lesson, comprehension sentence, etc.).';
COMMENT ON COLUMN public.audio_assets.content_type IS
  'e.g. lesson, comprehension_sentence — see app audio content registry.';
COMMENT ON COLUMN public.audio_assets.storage_path IS
  'Path in storage bucket for clip awaiting review (not live until approved).';

CREATE TABLE IF NOT EXISTS public.audio_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_asset_id UUID NOT NULL REFERENCES public.audio_assets (id) ON DELETE CASCADE,
  script_text TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS audio_generations_asset_idx
  ON public.audio_generations (audio_asset_id, created_at DESC);

ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage audio assets" ON public.audio_assets;
CREATE POLICY "Admins manage audio assets"
  ON public.audio_assets
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Public read audio assets" ON public.audio_assets;
CREATE POLICY "Public read audio assets"
  ON public.audio_assets
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage audio generations" ON public.audio_generations;
CREATE POLICY "Admins manage audio generations"
  ON public.audio_generations
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Public read audio generations" ON public.audio_generations;
CREATE POLICY "Public read audio generations"
  ON public.audio_generations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Migrate existing lesson audio into audio_assets
INSERT INTO public.audio_assets (
  content_type,
  content_id,
  script_text,
  storage_path,
  audio_url,
  status,
  created_at,
  updated_at
)
SELECT
  'lesson',
  l.id,
  l.audio_script,
  l.pending_audio_path,
  CASE WHEN l.generated_audio_status = 'approved' THEN l.audio_url ELSE NULL END,
  COALESCE(l.generated_audio_status, 'none'),
  now(),
  now()
FROM public.lessons l
WHERE l.audio_script IS NOT NULL
   OR l.pending_audio_path IS NOT NULL
   OR l.generated_audio_status IS NOT NULL AND l.generated_audio_status <> 'none'
   OR l.audio_url IS NOT NULL
ON CONFLICT (content_type, content_id) DO NOTHING;

-- Migrate generation history (when legacy table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lesson_audio_generations'
  ) THEN
    INSERT INTO public.audio_generations (
      audio_asset_id,
      script_text,
      storage_path,
      status,
      review_notes,
      reviewed_by,
      created_at,
      reviewed_at
    )
    SELECT
      aa.id,
      lag.script_text,
      lag.storage_path,
      lag.status,
      lag.review_notes,
      lag.reviewed_by,
      lag.created_at,
      lag.reviewed_at
    FROM public.lesson_audio_generations lag
    JOIN public.audio_assets aa
      ON aa.content_type = 'lesson' AND aa.content_id = lag.lesson_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audio_generations ag
      WHERE ag.audio_asset_id = aa.id
        AND ag.storage_path = lag.storage_path
        AND ag.created_at = lag.created_at
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
