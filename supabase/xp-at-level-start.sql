-- =============================================================================
-- Per-level test XP gate (lifetime total_xp is unchanged)
-- Run after learner-progression.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_at_level_start INTEGER NOT NULL DEFAULT 0
    CHECK (xp_at_level_start >= 0);

COMMENT ON COLUMN public.profiles.xp_at_level_start IS
  'total_xp snapshot when the current learner_level began. Test unlock uses total_xp minus this.';

-- Existing level 1 learners: all lifetime XP still counts toward their first test.
-- Level 2+: start fresh XP clock at current level (lifetime total unchanged).
UPDATE public.profiles
SET xp_at_level_start = CASE
  WHEN learner_level IS NULL OR learner_level <= 1 THEN 0
  ELSE total_xp
END
WHERE placement_completed_at IS NOT NULL;

-- Re-apply level-up snapshot logic (run updated functions from learner-progression.sql too)
