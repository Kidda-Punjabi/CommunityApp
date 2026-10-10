-- Admin can mark a cohort week-number gap as intentional.
-- Duplicates and out-of-order weeks are not stored here.
-- Service role only. Existing bad week numbers are left in place.

CREATE TABLE IF NOT EXISTS public.cohort_week_gap_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  gap_key text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  UNIQUE (cohort_id, gap_key)
);

COMMENT ON TABLE public.cohort_week_gap_acknowledgements IS
  'Admin marked a cohort class-session week gap as intentional. Does not allow duplicate or out-of-order week numbers.';

ALTER TABLE public.cohort_week_gap_acknowledgements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cohort_week_gap_acknowledgements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cohort_week_gap_acknowledgements TO service_role;

NOTIFY pgrst, 'reload schema';
