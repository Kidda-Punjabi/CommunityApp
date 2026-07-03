-- =============================================================================
-- Kidda — Conversation Practice (characters, scenarios, exchanges)
-- Run in Supabase SQL Editor
-- =============================================================================
-- RLS note: mirrors grammar_sentences / flashcards — public.is_admin() for writes.
-- (Not is_master_admin/is_community_lead directly; is_admin() covers those roles.)

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversation_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  avatar_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.conversation_characters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_scenarios_character
  ON public.conversation_scenarios (character_id, display_order);

CREATE TABLE IF NOT EXISTS public.conversation_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.conversation_scenarios(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  npc_setup_gurmukhi TEXT NOT NULL,
  npc_setup_romanised TEXT,
  npc_setup_english TEXT NOT NULL,
  prompt_instruction TEXT NOT NULL,
  target_response_gurmukhi TEXT NOT NULL,
  target_response_romanised TEXT,
  target_response_english TEXT NOT NULL,
  npc_reply_gurmukhi TEXT,
  npc_reply_romanised TEXT,
  npc_reply_english TEXT,
  is_ending BOOLEAN NOT NULL DEFAULT false,
  easy_blank_template_gurmukhi TEXT NOT NULL,
  easy_correct_word_gurmukhi TEXT NOT NULL,
  easy_correct_word_romanised TEXT,
  easy_option_b_gurmukhi TEXT NOT NULL,
  easy_option_b_romanised TEXT,
  easy_option_c_gurmukhi TEXT NOT NULL,
  easy_option_c_romanised TEXT,
  easy_option_d_gurmukhi TEXT NOT NULL,
  easy_option_d_romanised TEXT,
  medium_option_b_gurmukhi TEXT NOT NULL,
  medium_option_b_romanised TEXT,
  medium_option_b_english TEXT NOT NULL,
  medium_option_c_gurmukhi TEXT NOT NULL,
  medium_option_c_romanised TEXT,
  medium_option_c_english TEXT NOT NULL,
  medium_option_d_gurmukhi TEXT NOT NULL,
  medium_option_d_romanised TEXT,
  medium_option_d_english TEXT NOT NULL,
  hard_word_tiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversation_exchanges_scenario_sequence_unique
    UNIQUE (scenario_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_conversation_exchanges_scenario
  ON public.conversation_exchanges (scenario_id, sequence_order);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.conversation_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read conversation_characters" ON public.conversation_characters;
CREATE POLICY "Authenticated read conversation_characters"
  ON public.conversation_characters FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage conversation_characters" ON public.conversation_characters;
CREATE POLICY "Admins manage conversation_characters"
  ON public.conversation_characters FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read conversation_scenarios" ON public.conversation_scenarios;
CREATE POLICY "Authenticated read conversation_scenarios"
  ON public.conversation_scenarios FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage conversation_scenarios" ON public.conversation_scenarios;
CREATE POLICY "Admins manage conversation_scenarios"
  ON public.conversation_scenarios FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read conversation_exchanges" ON public.conversation_exchanges;
CREATE POLICY "Authenticated read conversation_exchanges"
  ON public.conversation_exchanges FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage conversation_exchanges" ON public.conversation_exchanges;
CREATE POLICY "Admins manage conversation_exchanges"
  ON public.conversation_exchanges FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.conversation_characters TO authenticated;
GRANT SELECT ON public.conversation_scenarios TO authenticated;
GRANT SELECT ON public.conversation_exchanges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversation_characters TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversation_scenarios TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversation_exchanges TO authenticated;
GRANT ALL ON public.conversation_characters TO service_role;
GRANT ALL ON public.conversation_scenarios TO service_role;
GRANT ALL ON public.conversation_exchanges TO service_role;

-- -----------------------------------------------------------------------------
-- 3. game_scores — add conversation_practice
-- -----------------------------------------------------------------------------

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type = ANY (ARRAY[
    'match',
    'memory_grid',
    'speed_translate',
    'word_scramble',
    'streak_survival',
    'sentence_builder',
    'conjugation_challenge',
    'gender_sort',
    'picture_match',
    'voice_practice',
    'chado_pauri',
    'conversation_practice'
  ]));

-- -----------------------------------------------------------------------------
-- 4. Seed — character + scenario only (no exchanges yet)
-- -----------------------------------------------------------------------------

INSERT INTO public.conversation_characters (name, role, description, icon_name, display_order, active)
SELECT
  'Shopkeeper',
  'Market vendor',
  'A friendly shopkeeper at the local bazaar.',
  'store',
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversation_characters WHERE name = 'Shopkeeper'
);

INSERT INTO public.conversation_scenarios (character_id, title, description, display_order, active)
SELECT
  c.id,
  'Buying Fabric at the Market',
  'Practice shopping for fabric in Punjabi.',
  0,
  true
FROM public.conversation_characters c
WHERE c.name = 'Shopkeeper'
  AND NOT EXISTS (
    SELECT 1
    FROM public.conversation_scenarios s
    WHERE s.title = 'Buying Fabric at the Market'
      AND s.character_id = c.id
  );

NOTIFY pgrst, 'reload schema';
