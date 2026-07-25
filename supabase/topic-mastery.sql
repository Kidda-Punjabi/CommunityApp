-- =============================================================================
-- Kidda — Per-topic mastery for Free Lessons (Duolingo-style progress)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  -- 0 = not started, 1–4 = crowns in progress, 5 = mastered
  mastery_level INTEGER NOT NULL DEFAULT 0
    CHECK (mastery_level >= 0 AND mastery_level <= 5),
  -- Progress toward the next mastery level (0–100). At 100, level ups.
  progress_percent INTEGER NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

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
