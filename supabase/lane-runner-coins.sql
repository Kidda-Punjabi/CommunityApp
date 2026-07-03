-- =============================================================================
-- Kidda — Lane Runner lifetime coin balance (profiles)
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0
    CHECK (coin_balance >= 0);

COMMENT ON COLUMN public.profiles.coin_balance IS
  'Lifetime collectible coins (Lane Runner and future rewards). Monotonic increase.';

CREATE OR REPLACE FUNCTION public.award_coins(p_coins INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_total INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_coins IS NULL OR p_coins <= 0 OR p_coins > 500 THEN
    RAISE EXCEPTION 'Invalid coin amount';
  END IF;

  UPDATE public.profiles
  SET coin_balance = coin_balance + p_coins
  WHERE id = v_user_id
  RETURNING coin_balance INTO v_new_total;

  RETURN v_new_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_coins(INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
