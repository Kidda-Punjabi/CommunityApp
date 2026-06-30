-- Track which Stripe checkout session last triggered onboarding for a student package.
-- Run in Supabase SQL editor. Safe to re-run.

ALTER TABLE public.student_packages
  ADD COLUMN IF NOT EXISTS last_stripe_checkout_session_id text;

COMMENT ON COLUMN public.student_packages.last_stripe_checkout_session_id IS
  'Stripe checkout session id for the purchase that created or refreshed onboarding. Renewals with the same session are ignored.';
