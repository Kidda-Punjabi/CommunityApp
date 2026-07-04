-- =============================================================================
-- Kidda — Conversation Practice turns + per-scenario cast (admin dialogue editor)
-- Run in Supabase SQL Editor after conversation-practice.sql and audio-assets.sql
-- =============================================================================

ALTER TABLE public.conversation_scenarios
  ADD COLUMN IF NOT EXISTS difficulty INTEGER
    CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5)),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
    CHECK (duration_minutes IS NULL OR duration_minutes > 0);

CREATE TABLE IF NOT EXISTS public.conversation_scenario_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.conversation_scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_label TEXT,
  default_voice_id TEXT,
  is_player_role BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_scenario_characters_scenario_name_unique
    UNIQUE (scenario_id, name)
);

CREATE INDEX IF NOT EXISTS idx_conversation_scenario_characters_scenario
  ON public.conversation_scenario_characters (scenario_id, display_order);

CREATE TABLE IF NOT EXISTS public.conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.conversation_scenarios(id) ON DELETE CASCADE,
  scenario_character_id UUID NOT NULL
    REFERENCES public.conversation_scenario_characters(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  gurmukhi_text TEXT NOT NULL,
  romanised_text TEXT NOT NULL,
  english_translation TEXT,
  audio_url TEXT,
  requires_audio BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_turns_scenario_sequence_unique
    UNIQUE (scenario_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_conversation_turns_scenario
  ON public.conversation_turns (scenario_id, sequence_order);

ALTER TABLE public.conversation_scenario_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read conversation_scenario_characters"
  ON public.conversation_scenario_characters;
CREATE POLICY "Authenticated read conversation_scenario_characters"
  ON public.conversation_scenario_characters FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage conversation_scenario_characters"
  ON public.conversation_scenario_characters;
CREATE POLICY "Admins manage conversation_scenario_characters"
  ON public.conversation_scenario_characters FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read conversation_turns" ON public.conversation_turns;
CREATE POLICY "Authenticated read conversation_turns"
  ON public.conversation_turns FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage conversation_turns" ON public.conversation_turns;
CREATE POLICY "Admins manage conversation_turns"
  ON public.conversation_turns FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.conversation_scenario_characters TO authenticated;
GRANT SELECT ON public.conversation_turns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversation_scenario_characters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversation_turns TO authenticated;
GRANT ALL ON public.conversation_scenario_characters TO service_role;
GRANT ALL ON public.conversation_turns TO service_role;

-- Storage — conversation-audio (public URLs, same pattern as comprehension-audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('conversation-audio', 'conversation-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read conversation audio" ON storage.objects;
CREATE POLICY "Public read conversation audio"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'conversation-audio');

DROP POLICY IF EXISTS "Admins upload conversation audio" ON storage.objects;
CREATE POLICY "Admins upload conversation audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'conversation-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update conversation audio" ON storage.objects;
CREATE POLICY "Admins update conversation audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'conversation-audio' AND public.is_admin())
  WITH CHECK (bucket_id = 'conversation-audio' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete conversation audio" ON storage.objects;
CREATE POLICY "Admins delete conversation audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'conversation-audio' AND public.is_admin());

NOTIFY pgrst, 'reload schema';
