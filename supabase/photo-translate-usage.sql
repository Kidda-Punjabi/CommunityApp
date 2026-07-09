-- =============================================================================
-- Kidda — Photo Translate monthly usage (25 scans / month cap)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.photo_translate_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  month_key   TEXT NOT NULL,
  scan_count  INTEGER NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_translate_usage_user_month_unique UNIQUE (user_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_photo_translate_usage_user_month
  ON public.photo_translate_usage (user_id, month_key);

COMMENT ON TABLE public.photo_translate_usage IS
  'Monthly scan usage for Photo Translate. Cap enforced in app logic:
   PHOTO_TRANSLATE_MONTHLY_CAP_SCANS = 25.';

CREATE OR REPLACE FUNCTION public.set_photo_translate_usage_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_translate_usage_updated_at ON public.photo_translate_usage;
CREATE TRIGGER trg_photo_translate_usage_updated_at
  BEFORE UPDATE ON public.photo_translate_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.set_photo_translate_usage_updated_at();

ALTER TABLE public.photo_translate_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own photo translate usage" ON public.photo_translate_usage;
CREATE POLICY "Users read own photo translate usage"
  ON public.photo_translate_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.photo_translate_usage TO authenticated;
GRANT ALL ON public.photo_translate_usage TO service_role;

NOTIFY pgrst, 'reload schema';
