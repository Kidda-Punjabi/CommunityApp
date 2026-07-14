-- =============================================================================
-- Kidda — Monthly reward winners (Prezzee gift cards)
-- Run in Supabase SQL Editor
-- Does NOT modify weekly_points or the weekly leaderboard.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_reward_winners (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_start        DATE NOT NULL,
  user_id            UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rank               INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
  points_total       INTEGER NOT NULL CHECK (points_total >= 0),
  gift_card_amount   NUMERIC(10, 2) NOT NULL CHECK (gift_card_amount IN (25.00, 20.00, 15.00)),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  gift_reference     TEXT,
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month_start, rank),
  UNIQUE (month_start, user_id)
);

COMMENT ON TABLE public.monthly_reward_winners IS
  'Top-3 monthly winners from weekly_points aggregates; gift cards fulfilled by admin.';
COMMENT ON COLUMN public.monthly_reward_winners.month_start IS
  'First day of the calendar month the rewards cover.';
COMMENT ON COLUMN public.monthly_reward_winners.gift_card_amount IS
  '25.00 / 20.00 / 15.00 for ranks 1 / 2 / 3.';
COMMENT ON COLUMN public.monthly_reward_winners.gift_reference IS
  'Prezzee link or fulfilment note once the gift card is sent.';

CREATE INDEX IF NOT EXISTS idx_monthly_reward_winners_status_month
  ON public.monthly_reward_winners (status, month_start DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_reward_winners_user
  ON public.monthly_reward_winners (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.monthly_reward_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own monthly reward wins" ON public.monthly_reward_winners;
CREATE POLICY "Users read own monthly reward wins"
  ON public.monthly_reward_winners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage monthly reward winners" ON public.monthly_reward_winners;
CREATE POLICY "Admins manage monthly reward winners"
  ON public.monthly_reward_winners
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin())
  WITH CHECK (public.is_admin() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE ON public.monthly_reward_winners TO authenticated;
