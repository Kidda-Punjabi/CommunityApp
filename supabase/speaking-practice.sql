-- =============================================================================
-- Kidda — Speaking Practice (monthly STT rate limit + game_scores type)
-- Run in Supabase SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Monthly attempt counter (60 transcriptions per user per calendar month)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.speaking_practice_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  flashcard_id  UUID REFERENCES public.flashcards (id) ON DELETE SET NULL,
  month_key     TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT speaking_practice_attempts_user_month_unique UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_speaking_practice_attempts_user_month
  ON public.speaking_practice_attempts (user_id, month_key);

COMMENT ON TABLE public.speaking_practice_attempts IS
  'Monthly ElevenLabs STT usage per user for Speaking Practice (max 60/month).';

-- ---------------------------------------------------------------------------
-- Atomic limit check + increment (server-authoritative)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_and_increment_speaking_attempt(
  p_user_id UUID,
  p_flashcard_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_key TEXT := to_char(timezone('UTC', now()), 'YYYY-MM');
  v_limit     INTEGER := 60;
  v_count     INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  INSERT INTO public.speaking_practice_attempts (user_id, month_key, attempt_count)
  VALUES (p_user_id, v_month_key, 0)
  ON CONFLICT (user_id, month_key) DO NOTHING;

  SELECT attempt_count
  INTO v_count
  FROM public.speaking_practice_attempts
  WHERE user_id = p_user_id
    AND month_key = v_month_key
  FOR UPDATE;

  IF v_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'attempt_count', v_count,
      'remaining', 0,
      'limit', v_limit,
      'month_key', v_month_key
    );
  END IF;

  UPDATE public.speaking_practice_attempts
  SET attempt_count = attempt_count + 1,
      flashcard_id = COALESCE(p_flashcard_id, flashcard_id),
      updated_at = now()
  WHERE user_id = p_user_id
    AND month_key = v_month_key
  RETURNING attempt_count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'attempt_count', v_count,
    'remaining', GREATEST(v_limit - v_count, 0),
    'limit', v_limit,
    'month_key', v_month_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_speaking_attempt(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.speaking_practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own speaking practice attempts" ON public.speaking_practice_attempts;
CREATE POLICY "Users read own speaking practice attempts"
  ON public.speaking_practice_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own speaking practice attempts" ON public.speaking_practice_attempts;
CREATE POLICY "Users update own speaking practice attempts"
  ON public.speaking_practice_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON public.speaking_practice_attempts TO authenticated;
GRANT ALL ON public.speaking_practice_attempts TO service_role;

-- ---------------------------------------------------------------------------
-- game_scores: speaking_practice
-- ---------------------------------------------------------------------------

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
    'conversation_practice',
    'possessive_practice',
    'spot_the_mistake',
    'comprehension_practice',
    'lane_runner',
    'speaking_practice'
  ]));

NOTIFY pgrst, 'reload schema';
