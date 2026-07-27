-- =============================================================================
-- Kidda — Tutor cover requests (auto-assign + 48h decline window)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_cover_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  requesting_tutor_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  assigned_tutor_id     UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending_assignment'
    CHECK (status IN (
      'pending_assignment',
      'assigned',
      'declined',
      'confirmed',
      'cancelled',
      'needs_admin'
    )),
  reason                TEXT,
  assigned_at           TIMESTAMPTZ,
  decision_deadline     TIMESTAMPTZ,
  decided_at            TIMESTAMPTZ,
  decline_reason        TEXT,
  attempt_count         INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_cover_requests IS
  'Tutor requests cover for a session. System auto-assigns an available tutor; 48h no-response = confirmed.';

CREATE INDEX IF NOT EXISTS idx_tutor_cover_requests_assigned_pending
  ON public.tutor_cover_requests (assigned_tutor_id, status, decision_deadline)
  WHERE status = 'assigned';

CREATE INDEX IF NOT EXISTS idx_tutor_cover_requests_session
  ON public.tutor_cover_requests (session_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_tutor_cover_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_cover_requests_updated_at ON public.tutor_cover_requests;
CREATE TRIGGER trg_tutor_cover_requests_updated_at
  BEFORE UPDATE ON public.tutor_cover_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_tutor_cover_requests_updated_at();

ALTER TABLE public.tutor_cover_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors manage own cover requests" ON public.tutor_cover_requests;
CREATE POLICY "Tutors manage own cover requests"
  ON public.tutor_cover_requests FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR requesting_tutor_id = auth.uid()
    OR assigned_tutor_id = auth.uid()
  )
  WITH CHECK (
    public.is_master_admin()
    OR requesting_tutor_id = auth.uid()
    OR assigned_tutor_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE ON public.tutor_cover_requests TO authenticated;

-- Allow in-app notification type for cover assignment
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
    'cohort_new_student',
    'tutor_cover_assigned'
  ));

NOTIFY pgrst, 'reload schema';
