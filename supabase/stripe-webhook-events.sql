-- Lightweight Stripe webhook processing log (service_role writes; no client access).
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id                    TEXT PRIMARY KEY,
  event_type            TEXT NOT NULL,
  livemode              BOOLEAN NOT NULL DEFAULT true,
  checkout_session_id   TEXT,
  processing_status     TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  error_message         TEXT,
  payload_summary       JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received
  ON public.stripe_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_session
  ON public.stripe_webhook_events (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stripe_webhook_events FROM authenticated, anon;
GRANT ALL ON public.stripe_webhook_events TO service_role;

COMMENT ON TABLE public.stripe_webhook_events IS
  'Audit log for Stripe webhook handling — diagnose silent misses (e.g. 1-to-1 booking credits).';
