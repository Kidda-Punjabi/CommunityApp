-- =============================================================================
-- Kidda — Per-topic mastery for Everyday Punjabi (3 stages × 5 deep levels)
-- Run in Supabase SQL Editor when ready — app also falls back to lesson_progress.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  -- Legacy flat field (also used as units 0–15 when stage/depth unavailable)
  mastery_level INTEGER NOT NULL DEFAULT 0
    CHECK (mastery_level >= 0 AND mastery_level <= 15),
  progress_percent INTEGER NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  -- 1 = Vocab (red), 2 = Sentences (yellow), 3 = Conversation (green)
  stage INTEGER NOT NULL DEFAULT 1
    CHECK (stage >= 1 AND stage <= 3),
  -- Deep levels completed inside the current stage (0–5)
  depth INTEGER NOT NULL DEFAULT 0
    CHECK (depth >= 0 AND depth <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.topic_mastery
  ADD COLUMN IF NOT EXISTS stage INTEGER NOT NULL DEFAULT 1
    CHECK (stage >= 1 AND stage <= 3);

ALTER TABLE public.topic_mastery
  ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0
    CHECK (depth >= 0 AND depth <= 5);

-- Widen legacy mastery_level if an older 0–5 check exists
ALTER TABLE public.topic_mastery
  DROP CONSTRAINT IF EXISTS topic_mastery_mastery_level_check;

ALTER TABLE public.topic_mastery
  ADD CONSTRAINT topic_mastery_mastery_level_check
  CHECK (mastery_level >= 0 AND mastery_level <= 15);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_id
  ON public.topic_mastery (user_id);

CREATE OR REPLACE FUNCTION public.set_topic_mastery_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS topic_mastery_updated_at ON public.topic_mastery;
CREATE TRIGGER topic_mastery_updated_at
  BEFORE UPDATE ON public.topic_mastery
  FOR EACH ROW
  EXECUTE FUNCTION public.set_topic_mastery_updated_at();

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own topic mastery" ON public.topic_mastery;
CREATE POLICY "Users manage own topic mastery"
  ON public.topic_mastery FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_mastery TO authenticated;
GRANT ALL ON public.topic_mastery TO service_role;

NOTIFY pgrst, 'reload schema';
