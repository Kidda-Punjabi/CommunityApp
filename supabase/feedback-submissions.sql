-- =============================================================================
-- Kidda — In-app lesson feedback (Notion sync with Supabase fallback)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons (id) ON DELETE SET NULL,

  form_variant TEXT NOT NULL DEFAULT 'standard'
    CHECK (form_variant IN ('standard', 'week12')),

  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cohort TEXT,
  course TEXT NOT NULL,
  lesson_label TEXT NOT NULL,
  tutor TEXT,
  tutor_unmatched BOOLEAN NOT NULL DEFAULT false,

  -- Standard lesson ratings (always collected)
  learning_relevance INTEGER NOT NULL CHECK (learning_relevance BETWEEN 1 AND 5),
  tutor_effectiveness INTEGER NOT NULL CHECK (tutor_effectiveness BETWEEN 1 AND 5),
  confidence INTEGER NOT NULL CHECK (confidence BETWEEN 1 AND 5),

  -- Week 12 end-of-course ratings (nullable for standard submissions)
  understanding INTEGER CHECK (understanding IS NULL OR understanding BETWEEN 1 AND 5),
  speaking INTEGER CHECK (speaking IS NULL OR speaking BETWEEN 1 AND 5),
  understanding_grammar INTEGER CHECK (understanding_grammar IS NULL OR understanding_grammar BETWEEN 1 AND 5),
  clarity_structure INTEGER CHECK (clarity_structure IS NULL OR clarity_structure BETWEEN 1 AND 5),
  concept_breakdown INTEGER CHECK (concept_breakdown IS NULL OR concept_breakdown BETWEEN 1 AND 5),
  supportiveness INTEGER CHECK (supportiveness IS NULL OR supportiveness BETWEEN 1 AND 5),
  overall_score INTEGER CHECK (overall_score IS NULL OR overall_score BETWEEN 1 AND 5),

  comments TEXT NOT NULL DEFAULT '',
  testimonials TEXT,
  recommend TEXT CHECK (recommend IS NULL OR recommend IN ('Yes', 'No')),
  video_testimonial TEXT CHECK (video_testimonial IS NULL OR video_testimonial IN ('Yes', 'No')),
  future_support TEXT[] NOT NULL DEFAULT '{}',

  notion_page_id TEXT,
  notion_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notion_sync_status IN ('pending', 'synced', 'failed')),
  notion_sync_error TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notion_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_id
  ON public.feedback_submissions (user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_notion_sync_status
  ON public.feedback_submissions (notion_sync_status)
  WHERE notion_sync_status <> 'synced';

ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own feedback" ON public.feedback_submissions;
CREATE POLICY "Users insert own feedback"
  ON public.feedback_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own feedback" ON public.feedback_submissions;
CREATE POLICY "Users read own feedback"
  ON public.feedback_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own feedback sync" ON public.feedback_submissions;
CREATE POLICY "Users update own feedback sync"
  ON public.feedback_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.feedback_submissions TO authenticated;
GRANT ALL ON public.feedback_submissions TO service_role;

NOTIFY pgrst, 'reload schema';
