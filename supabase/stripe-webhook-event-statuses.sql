-- Allow premium payment-link checkouts to stay visible when no app user
-- was resolved, and to flag a second live subscription instead of overwriting.
ALTER TABLE public.stripe_webhook_events
  DROP CONSTRAINT IF EXISTS stripe_webhook_events_processing_status_check;

ALTER TABLE public.stripe_webhook_events
  ADD CONSTRAINT stripe_webhook_events_processing_status_check
  CHECK (processing_status IN (
    'received',
    'processed',
    'ignored',
    'failed',
    'unmatched',
    'duplicate_subscription'
  ));

NOTIFY pgrst, 'reload schema';
