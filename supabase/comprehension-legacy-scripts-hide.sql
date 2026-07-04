-- =============================================================================
-- Kidda — Comprehension legacy scripts (pre-tier batch)
-- Run in Supabase SQL Editor after comprehension-paragraphs-tier.sql
-- =============================================================================
-- "A Day at School" and "A Family Get-together" predate the tier + paragraph
-- structure. They are flagged needs_rewrite by comprehension-paragraphs-tier.sql
-- and are hidden from learners by the app filter (no tier / no paragraphs).
--
-- This migration deactivates them explicitly so they stay admin-visible only
-- until manually rewritten into Short/Medium/Long with paragraphs + approved audio.
-- =============================================================================

UPDATE public.comprehension_scripts
SET active = false
WHERE title IN ('A Day at School', 'A Family Get-together')
  AND (tier IS NULL OR needs_rewrite = true);

NOTIFY pgrst, 'reload schema';
