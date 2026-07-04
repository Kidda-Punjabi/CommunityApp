-- =============================================================================
-- Kidda — Comprehension Practice tiers + paragraphs
-- Run in Supabase SQL Editor after comprehension-practice.sql
-- =============================================================================
-- Does NOT auto-wrap legacy flat sentences in fake paragraphs — flags scripts for
-- manual rewrite instead.

-- Tier (length) alongside difficulty (language level)
ALTER TABLE public.comprehension_scripts
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IS NULL OR tier IN ('short', 'medium', 'long')),
  ADD COLUMN IF NOT EXISTS needs_rewrite BOOLEAN NOT NULL DEFAULT false;

-- Expand difficulty to 1–10 (drop old 1–5 check if present)
ALTER TABLE public.comprehension_scripts
  DROP CONSTRAINT IF EXISTS comprehension_scripts_difficulty_check;

ALTER TABLE public.comprehension_scripts
  ADD CONSTRAINT comprehension_scripts_difficulty_check
  CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 10));

CREATE TABLE IF NOT EXISTS public.comprehension_paragraphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.comprehension_scripts(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comprehension_paragraphs_script_sequence_unique
    UNIQUE (script_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_comprehension_paragraphs_script
  ON public.comprehension_paragraphs (script_id, sequence_order);

ALTER TABLE public.comprehension_sentences
  ADD COLUMN IF NOT EXISTS paragraph_id UUID
    REFERENCES public.comprehension_paragraphs(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_comprehension_sentences_paragraph
  ON public.comprehension_sentences (paragraph_id, sequence_order);

ALTER TABLE public.comprehension_sentences
  DROP CONSTRAINT IF EXISTS comprehension_sentences_script_sequence_unique;

CREATE UNIQUE INDEX IF NOT EXISTS comprehension_sentences_paragraph_sequence_unique
  ON public.comprehension_sentences (paragraph_id, sequence_order)
  WHERE paragraph_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS comprehension_sentences_script_orphan_sequence_unique
  ON public.comprehension_sentences (script_id, sequence_order)
  WHERE paragraph_id IS NULL;

ALTER TABLE public.comprehension_paragraphs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read comprehension_paragraphs" ON public.comprehension_paragraphs;
CREATE POLICY "Authenticated read comprehension_paragraphs"
  ON public.comprehension_paragraphs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage comprehension_paragraphs" ON public.comprehension_paragraphs;
CREATE POLICY "Admins manage comprehension_paragraphs"
  ON public.comprehension_paragraphs FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.comprehension_paragraphs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comprehension_paragraphs TO authenticated;
GRANT ALL ON public.comprehension_paragraphs TO service_role;

-- Flag legacy flat scripts for manual rewrite (no fake paragraph migration)
UPDATE public.comprehension_scripts s
SET needs_rewrite = true
WHERE EXISTS (
  SELECT 1 FROM public.comprehension_sentences sen WHERE sen.script_id = s.id
)
AND (
  s.tier IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM public.comprehension_paragraphs p WHERE p.script_id = s.id
  )
  OR EXISTS (
    SELECT 1 FROM public.comprehension_sentences sen
    WHERE sen.script_id = s.id AND sen.paragraph_id IS NULL
  )
);

NOTIFY pgrst, 'reload schema';
