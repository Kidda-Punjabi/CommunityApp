-- Paid under-cutoff session rebook (£35 Session Rebook Payment Link).
-- client_reference_id on Stripe checkout = pending_rebookings.id

CREATE TABLE IF NOT EXISTS public.pending_rebookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tutor_profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  original_session_id UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  proposed_start_time TIMESTAMPTZ NOT NULL,
  proposed_end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'booked', 'failed', 'expired')),
  stripe_checkout_session_id TEXT,
  failure_reason TEXT,
  booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_rebookings_stripe_session
  ON public.pending_rebookings (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_rebookings_student_pending
  ON public.pending_rebookings (student_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pending_rebookings_session
  ON public.pending_rebookings (original_session_id, status);

COMMENT ON TABLE public.pending_rebookings IS
  'Holds £35 Session Rebook context across Stripe Payment Link checkout via client_reference_id.';

COMMENT ON COLUMN public.pending_rebookings.original_session_id IS
  'tutor_scheduled_sessions row being moved after verified payment.';

ALTER TABLE public.pending_rebookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own pending rebookings" ON public.pending_rebookings;
CREATE POLICY "Students read own pending rebookings"
  ON public.pending_rebookings FOR SELECT TO authenticated
  USING (student_profile_id = auth.uid());

-- Inserts/updates go through service role / server actions with elevated client.
GRANT SELECT ON public.pending_rebookings TO authenticated;
GRANT ALL ON public.pending_rebookings TO service_role;

NOTIFY pgrst, 'reload schema';
