-- =============================================================================
-- Kidda — ElevenLabs TTS improvements (voice tracking, variations, pronunciation)
-- Run in Supabase SQL Editor after audio-assets.sql
-- =============================================================================

ALTER TABLE public.audio_generations
  ADD COLUMN IF NOT EXISTS voice_id TEXT,
  ADD COLUMN IF NOT EXISTS variation_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_batch_id UUID;

COMMENT ON COLUMN public.audio_generations.voice_id IS
  'ElevenLabs voice ID used for this generation.';
COMMENT ON COLUMN public.audio_generations.variation_index IS
  '0 for single take; 1..N for multi-variation batches.';
COMMENT ON COLUMN public.audio_generations.generation_batch_id IS
  'Links variations generated in the same multi-take action.';

CREATE TABLE IF NOT EXISTS public.elevenlabs_tts_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pronunciation_dictionary_id TEXT,
  pronunciation_dictionary_version_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.elevenlabs_tts_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pronunciation_dictionary_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_word TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('alias', 'phoneme')),
  replacement TEXT NOT NULL,
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  word_boundaries BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pronunciation_rules_source_unique UNIQUE (source_word)
);

CREATE INDEX IF NOT EXISTS pronunciation_rules_source_idx
  ON public.pronunciation_dictionary_rules (source_word);

ALTER TABLE public.elevenlabs_tts_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_dictionary_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage elevenlabs tts config" ON public.elevenlabs_tts_config;
CREATE POLICY "Admins manage elevenlabs tts config"
  ON public.elevenlabs_tts_config
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Public read elevenlabs tts config" ON public.elevenlabs_tts_config;
CREATE POLICY "Public read elevenlabs tts config"
  ON public.elevenlabs_tts_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage pronunciation rules" ON public.pronunciation_dictionary_rules;
CREATE POLICY "Admins manage pronunciation rules"
  ON public.pronunciation_dictionary_rules
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Public read pronunciation rules" ON public.pronunciation_dictionary_rules;
CREATE POLICY "Public read pronunciation rules"
  ON public.pronunciation_dictionary_rules
  FOR SELECT
  TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
