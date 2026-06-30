-- =============================================================================
-- Kidda — Student & Blue Light discount verification (Beginners course)
-- Run in Supabase SQL Editor after friends-notifications.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- student_discount_requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_discount_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_format   TEXT NOT NULL
    CHECK (course_format IN ('group', 'one_to_one')),
  discount_type   TEXT NOT NULL DEFAULT 'student'
    CHECK (discount_type IN ('student', 'bluelight')),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  storage_path    TEXT NOT NULL,
  mime_type       TEXT,
  discount_code   TEXT,
  admin_notes     TEXT,
  reviewed_by     UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_format, discount_type)
);

COMMENT ON TABLE public.student_discount_requests IS
  'Student ID and Blue Light Card verification for Beginners course discounts.';
COMMENT ON COLUMN public.student_discount_requests.discount_type IS
  'student = student ID; bluelight = Blue Light Card (NHS, emergency services, etc.).';
COMMENT ON COLUMN public.student_discount_requests.course_format IS
  'group = live group course; one_to_one = private 1-to-1 course.';
COMMENT ON COLUMN public.student_discount_requests.discount_code IS
  'Stripe promotion code revealed to the student after approval.';

CREATE INDEX IF NOT EXISTS idx_student_discount_requests_status
  ON public.student_discount_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_discount_requests_user
  ON public.student_discount_requests (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_student_discount_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_discount_requests_updated_at ON public.student_discount_requests;
CREATE TRIGGER trg_student_discount_requests_updated_at
  BEFORE UPDATE ON public.student_discount_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_student_discount_request_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket (private — student ID evidence)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-discount-evidence',
  'student-discount-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS: student_discount_requests
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_discount_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users read own student discount requests"
  ON public.student_discount_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users insert own student discount requests"
  ON public.student_discount_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users update own rejected student discount requests" ON public.student_discount_requests;
CREATE POLICY "Users update own rejected student discount requests"
  ON public.student_discount_requests
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Admins manage student discount requests" ON public.student_discount_requests;
CREATE POLICY "Admins manage student discount requests"
  ON public.student_discount_requests
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin())
  WITH CHECK (public.is_admin() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE ON public.student_discount_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: storage.objects for student-discount-evidence
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users upload own student discount evidence" ON storage.objects;
CREATE POLICY "Users upload own student discount evidence"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-discount-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users read own student discount evidence" ON storage.objects;
CREATE POLICY "Users read own student discount evidence"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-discount-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins read student discount evidence" ON storage.objects;
CREATE POLICY "Admins read student discount evidence"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-discount-evidence'
    AND (public.is_admin() OR public.is_master_admin())
  );

-- ---------------------------------------------------------------------------
-- Notification type for discount approval
-- ---------------------------------------------------------------------------

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
    'student_discount_rejected'
  ));

NOTIFY pgrst, 'reload schema';
