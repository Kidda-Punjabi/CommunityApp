-- =============================================================================
-- Kidda — Match game high scores per flashcard deck
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.match_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  deck_name TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_time_seconds INTEGER NOT NULL DEFAULT 60,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, deck_name)
);

CREATE INDEX IF NOT EXISTS idx_match_scores_user_id ON public.match_scores (user_id);

ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own match scores" ON public.match_scores;
CREATE POLICY "Users manage own match scores"
  ON public.match_scores FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_scores TO authenticated;
GRANT ALL ON public.match_scores TO service_role;

NOTIFY pgrst, 'reload schema';
