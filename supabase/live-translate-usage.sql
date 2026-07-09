-- =============================================================================
-- Kidda — Live Translate monthly usage (15 min / month cap)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.live_translate_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  month_key    TEXT NOT NULL,
  seconds_used INTEGER NOT NULL DEFAULT 0 CHECK (seconds_used >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT live_translate_usage_user_month_unique UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_live_translate_usage_user_month
  ON public.live_translate_usage (user_id, month_key);

COMMENT ON TABLE public.live_translate_usage IS
  'Monthly conversation-time usage for Live Translate. Cap enforced in app
   logic: LIVE_TRANSLATE_MONTHLY_CAP_SECONDS = 900 (15 min).';

CREATE OR REPLACE FUNCTION public.set_live_translate_usage_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_translate_usage_updated_at ON public.live_translate_usage;
CREATE TRIGGER trg_live_translate_usage_updated_at
  BEFORE UPDATE ON public.live_translate_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.set_live_translate_usage_updated_at();

ALTER TABLE public.live_translate_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own live translate usage" ON public.live_translate_usage;
CREATE POLICY "Users read own live translate usage"
  ON public.live_translate_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.live_translate_usage TO authenticated;
GRANT ALL ON public.live_translate_usage TO service_role;

NOTIFY pgrst, 'reload schema';
