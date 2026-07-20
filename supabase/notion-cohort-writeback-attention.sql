-- =============================================================================
-- Kidda — Admin attention for failed Notion cohort Confirmed write-back
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notion_cohort_writeback_attention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  email text,
  reason text NOT NULL CHECK (
    reason IN (
      'no_notion_page',
      'no_lead',
      'ambiguous_lead',
      'notion_write_failed'
    )
  ),
  lead_page_ids text[] NOT NULL DEFAULT '{}',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_cohort_writeback_attention_open
  ON public.notion_cohort_writeback_attention (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.notion_cohort_writeback_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read cohort writeback attention" ON public.notion_cohort_writeback_attention;
CREATE POLICY "Staff read cohort writeback attention"
  ON public.notion_cohort_writeback_attention FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Service role manage cohort writeback attention" ON public.notion_cohort_writeback_attention;
CREATE POLICY "Service role manage cohort writeback attention"
  ON public.notion_cohort_writeback_attention FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.notion_cohort_writeback_attention IS
  'Open items when app enrollment could not add a student to Notion Confirmed (missing/ambiguous lead, etc.).';

NOTIFY pgrst, 'reload schema';
