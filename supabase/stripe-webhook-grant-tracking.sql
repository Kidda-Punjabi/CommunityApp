-- =============================================================================
-- Kidda — Stripe Webhook Grant Tracking
-- Tracks whether successful payment webhooks resulted in complete access grants
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

-- Add grant tracking columns to stripe_webhook_events
ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_status TEXT
    CHECK (grant_status IN ('not_applicable', 'pending', 'completed', 'failed', 'needs_retry'));

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_attempted_at TIMESTAMPTZ;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_completed_at TIMESTAMPTZ;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_error TEXT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_email TEXT;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS grant_last_retry_at TIMESTAMPTZ;

-- Index for finding events that need retry
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_grant_retry
  ON public.stripe_webhook_events (grant_status, grant_last_retry_at)
  WHERE grant_status IN ('pending', 'failed', 'needs_retry');

-- Index for finding events by profile
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_grant_profile
  ON public.stripe_webhook_events (grant_profile_id)
  WHERE grant_profile_id IS NOT NULL;

-- Index for finding events by email
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_grant_email
  ON public.stripe_webhook_events (grant_email)
  WHERE grant_email IS NOT NULL;

COMMENT ON COLUMN public.stripe_webhook_events.grant_status IS
  'Tracks whether this payment event resulted in complete access grant. not_applicable=non-course payment, pending=awaiting match/signup, completed=all 4 records created, failed=grant attempted but errored, needs_retry=incomplete grant requiring retry';

COMMENT ON COLUMN public.stripe_webhook_events.grant_profile_id IS
  'User profile this payment was matched to (via email or client_reference_id)';

COMMENT ON COLUMN public.stripe_webhook_events.grant_email IS
  'Email from checkout session customer_details, used for matching before profile exists';

COMMENT ON COLUMN public.stripe_webhook_events.grant_retry_count IS
  'Number of times grant has been retried (for backoff/abandonment logic)';

-- Backfill existing events as not_applicable (they're already processed, this tracking is prospective)
UPDATE public.stripe_webhook_events
SET grant_status = 'not_applicable'
WHERE grant_status IS NULL;

-- Make grant_status NOT NULL after backfill
ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN grant_status SET NOT NULL;

ALTER TABLE public.stripe_webhook_events
  ALTER COLUMN grant_status SET DEFAULT 'not_applicable';

-- Function to atomically increment retry count
CREATE OR REPLACE FUNCTION public.increment_webhook_grant_retry(
  p_event_id TEXT,
  p_status TEXT,
  p_retry_at TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stripe_webhook_events
  SET
    grant_status = p_status,
    grant_retry_count = grant_retry_count + 1,
    grant_last_retry_at = p_retry_at
  WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_webhook_grant_retry TO service_role;

NOTIFY pgrst, 'reload schema';
