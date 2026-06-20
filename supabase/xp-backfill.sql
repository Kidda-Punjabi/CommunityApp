-- =============================================================================
-- One-time backfill: lifetime XP from historical weekly leaderboard points
-- Run once after deploying award_xp wiring (same amounts were earned as weekly pts)
-- =============================================================================

UPDATE public.profiles p
SET total_xp = GREATEST(
  p.total_xp,
  COALESCE((
    SELECT SUM(wp.points)::INTEGER
    FROM public.weekly_points wp
    WHERE wp.user_id = p.id
  ), 0)
)
WHERE COALESCE(p.total_xp, 0) < COALESCE((
  SELECT SUM(wp.points)::INTEGER
  FROM public.weekly_points wp
  WHERE wp.user_id = p.id
), 0);
