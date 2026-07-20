-- =============================================================================
-- Kidda — Temporary cohort seat holds during Stripe checkout (group packages)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cohort_seat_holds (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id                   UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stripe_checkout_session_id  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                  TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE public.cohort_seat_holds IS
  'Short-lived seat reservation while a member completes Stripe checkout for a group cohort.';

CREATE INDEX IF NOT EXISTS idx_cohort_seat_holds_cohort_expires
  ON public.cohort_seat_holds (cohort_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_cohort_seat_holds_user
  ON public.cohort_seat_holds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cohort_seat_holds_stripe_session
  ON public.cohort_seat_holds (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.cohort_seat_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cohort seat holds" ON public.cohort_seat_holds;
CREATE POLICY "Users manage own cohort seat holds"
  ON public.cohort_seat_holds
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read cohort seat holds" ON public.cohort_seat_holds;
CREATE POLICY "Admins read cohort seat holds"
  ON public.cohort_seat_holds
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_seat_holds TO authenticated;

-- Notification types for group purchase flow
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'friend_level_up',
    'kudos',
    'announcement',
    'friend_game_challenge',
    'friend_game_challenge_result',
    'homework_reviewed',
    'cohort_switch_requested',
    'cohort_switch_resolved',
    'lesson_reschedule_requested',
    'lesson_reschedule_resolved',
    'student_discount_approved',
    'student_discount_rejected',
    'cohort_placement_pending',
    'cohort_new_student'
  ));

NOTIFY pgrst, 'reload schema';
