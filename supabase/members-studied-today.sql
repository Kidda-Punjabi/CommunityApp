-- =============================================================================
-- Kidda — Count members with streak activity on a given calendar date
-- Run in Supabase SQL Editor (after progress.sql / streaks.sql)
-- =============================================================================
--
-- Uses user_streaks.last_activity_date (set when a user completes streak-qualifying
-- activity). p_activity_date should match the viewer's local activity date.
-- Note: dates are stored per-user in their local calendar when they studied,
-- so this count is approximate for a global "today" ticker.

CREATE OR REPLACE FUNCTION public.count_members_studied_on_date(p_activity_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_streaks
  WHERE last_activity_date = p_activity_date;
$$;

GRANT EXECUTE ON FUNCTION public.count_members_studied_on_date(DATE) TO authenticated;
