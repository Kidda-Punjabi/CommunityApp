-- =============================================================================
-- Kidda — Notion Feedback Database mirror for the admin Delivery tab
-- Source data source: collection://30eb5ac4-29c6-80b1-9e66-000b4261f8eb
-- Database ID (API 2022-06-28): 30eb5ac4-29c6-80ec-b673-e0d575ba9c1d
--
-- One-way Notion → Supabase for all fields except Actioned and
-- Video Testimonial Recorded (dashboard edits write both stores immediately).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL,
  full_name text,
  email text,
  tutor text,
  cohort text,
  course text,
  lesson text,
  feedback_date timestamptz,
  learning_relevance numeric,
  confidence numeric,
  tutor_effectiveness numeric,
  understanding numeric,
  speaking numeric,
  understanding_grammar numeric,
  clarity_structure numeric,
  concept_breakdown numeric,
  supportiveness numeric,
  overall_score numeric,
  video_testimonial text,
  video_testimonial_recorded text,
  actioned text,
  critical_feedback boolean,
  comments text,
  notes text,
  local_updated_at timestamptz,
  notion_last_edited_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_responses_notion_page_id_key UNIQUE (notion_page_id)
);

COMMENT ON TABLE public.feedback_responses IS
  'Mirror of Notion Feedback Database. Dashboard reads this table. Actioned and Video Testimonial Recorded are two-way.';
COMMENT ON COLUMN public.feedback_responses.local_updated_at IS
  'Set when Actioned or Video Testimonial Recorded is edited on the dashboard. Cron leaves those fields alone unless Notion last_edited_time is newer.';

CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback_date
  ON public.feedback_responses (feedback_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_tutor_date
  ON public.feedback_responses (tutor, feedback_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_actioned
  ON public.feedback_responses (actioned);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_critical
  ON public.feedback_responses (critical_feedback)
  WHERE critical_feedback IS TRUE;

CREATE INDEX IF NOT EXISTS idx_feedback_responses_testimonial
  ON public.feedback_responses (lesson, video_testimonial, video_testimonial_recorded);

CREATE OR REPLACE FUNCTION public.set_feedback_responses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_responses_updated_at ON public.feedback_responses;
CREATE TRIGGER trg_feedback_responses_updated_at
  BEFORE UPDATE ON public.feedback_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_feedback_responses_updated_at();

ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read feedback responses" ON public.feedback_responses;
CREATE POLICY "Staff read feedback responses"
  ON public.feedback_responses FOR SELECT TO authenticated
  USING (public.is_community_lead() OR public.is_master_admin());

DROP POLICY IF EXISTS "Staff manage feedback responses" ON public.feedback_responses;
CREATE POLICY "Staff manage feedback responses"
  ON public.feedback_responses FOR ALL TO authenticated
  USING (public.is_community_lead() OR public.is_master_admin())
  WITH CHECK (public.is_community_lead() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_responses TO authenticated;
GRANT ALL ON public.feedback_responses TO service_role;

NOTIFY pgrst, 'reload schema';
