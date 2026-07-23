-- =============================================================================
-- Kidda — Speak It (voice_practice) ElevenLabs STT monthly rate limit
-- Separate from speaking_practice_attempts and live_translate_usage.
-- Default: 60 transcriptions per user per UTC calendar month (matches Speaking Practice).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.voice_practice_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sentence_id   UUID,
  month_key     TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_practice_attempts_user_month_unique UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_voice_practice_attempts_user_month
  ON public.voice_practice_attempts (user_id, month_key);

COMMENT ON TABLE public.voice_practice_attempts IS
  'Monthly ElevenLabs STT usage per user for Speak It / voice_practice (max 60/month). Separate from Speaking Practice.';

CREATE OR REPLACE FUNCTION public.check_and_increment_voice_practice_attempt(
  p_user_id UUID,
  p_sentence_id UUID DEFAULT NULL
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

  INSERT INTO public.voice_practice_attempts (user_id, month_key, attempt_count)
  VALUES (p_user_id, v_month_key, 0)
  ON CONFLICT (user_id, month_key) DO NOTHING;

  SELECT attempt_count
  INTO v_count
  FROM public.voice_practice_attempts
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

  UPDATE public.voice_practice_attempts
  SET attempt_count = attempt_count + 1,
      sentence_id = COALESCE(p_sentence_id, sentence_id),
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

GRANT EXECUTE ON FUNCTION public.check_and_increment_voice_practice_attempt(UUID, UUID)
  TO authenticated;

ALTER TABLE public.voice_practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own voice practice attempts"
  ON public.voice_practice_attempts;
CREATE POLICY "Users read own voice practice attempts"
  ON public.voice_practice_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.voice_practice_attempts TO authenticated;
GRANT ALL ON public.voice_practice_attempts TO service_role;

NOTIFY pgrst, 'reload schema';
