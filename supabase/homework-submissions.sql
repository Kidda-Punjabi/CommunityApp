-- =============================================================================
-- Kidda — Homework voice submissions + tutor review
-- Run in Supabase SQL Editor after tutor-cohort-access.sql and
-- friend-game-challenges.sql (extends notification types).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- homework_submissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,
  mime_type        TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  status           TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'reviewed')),
  approved         BOOLEAN,
  tutor_comment    TEXT,
  reviewed_by      UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, student_id),
  CONSTRAINT homework_submissions_approved_when_reviewed CHECK (
    (status = 'pending_review' AND approved IS NULL)
    OR (status = 'reviewed' AND approved IS NOT NULL)
  )
);

COMMENT ON TABLE public.homework_submissions IS
  'One homework voice submission per student per lesson. Locked (no resubmission) once status = reviewed, regardless of approved outcome.';
COMMENT ON COLUMN public.homework_submissions.approved IS
  'NULL until reviewed. true = approved, false = reviewed but not approved (e.g. needs improvement). Either reviewed state is locked.';

CREATE INDEX IF NOT EXISTS idx_homework_submissions_student
  ON public.homework_submissions (student_id);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_lesson
  ON public.homework_submissions (lesson_id);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_status
  ON public.homework_submissions (status)
  WHERE status = 'pending_review';

-- ---------------------------------------------------------------------------
-- Validation: Foundational / Beginners only (not Community)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_homework_submission_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT c.required_tier INTO v_tier
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = NEW.lesson_id;

  IF COALESCE(v_tier, '') NOT IN ('foundational', 'beginners') THEN
    RAISE EXCEPTION 'Homework submissions are only allowed for Foundational and Beginners courses.';
  END IF;

  IF NEW.student_id <> auth.uid()
     AND NOT public.is_tutor()
     AND NOT public.is_master_admin() THEN
  -- service_role / triggers may bypass; app inserts as student
    NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_submission_course ON public.homework_submissions;
CREATE TRIGGER trg_homework_submission_course
  BEFORE INSERT OR UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_homework_submission_course();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tutor_teaches_student_for_lesson(
  p_tutor_id UUID,
  p_student_id UUID,
  p_lesson_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    JOIN public.lessons l ON l.id = p_lesson_id
    WHERE ce.user_id = p_student_id
      AND ce.course_id = l.course_id
      AND ce.tutor_id = p_tutor_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.cohort_members cm
    JOIN public.cohorts co ON co.id = cm.cohort_id
    JOIN public.lessons l ON l.id = p_lesson_id
    WHERE cm.user_id = p_student_id
      AND cm.left_at IS NULL
      AND co.tutor_id = p_tutor_id
      AND l.course_id = co.course_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_homework_submission(
  p_user_id UUID,
  p_submission_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.homework_submissions%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.homework_submissions hs
  WHERE hs.id = p_submission_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_row.student_id = p_user_id THEN
    RETURN true;
  END IF;

  IF public.is_master_admin() THEN
    RETURN true;
  END IF;

  RETURN public.tutor_teaches_student_for_lesson(
    p_user_id,
    v_row.student_id,
    v_row.lesson_id
  );
END;
$$;

-- Prevent tutors from changing review fields after submission is reviewed
CREATE OR REPLACE FUNCTION public.enforce_homework_submission_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'reviewed' THEN
    RAISE EXCEPTION 'Reviewed homework submissions cannot be modified.';
  END IF;

  IF auth.uid() = OLD.student_id THEN
    RAISE EXCEPTION 'Students cannot update homework after submission.';
  END IF;

  IF TG_OP = 'UPDATE' AND (public.is_tutor() OR public.is_master_admin()) THEN
  -- Tutor review: only allow review columns to change
    IF NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Tutors may only update review fields on homework submissions.';
    END IF;

    IF NEW.status <> 'reviewed' THEN
      RAISE EXCEPTION 'Tutor review must set status to reviewed.';
    END IF;

    IF NEW.approved IS NULL THEN
      RAISE EXCEPTION 'approved must be set when marking homework as reviewed.';
    END IF;

    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_submission_review ON public.homework_submissions;
CREATE TRIGGER trg_homework_submission_review
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_homework_submission_review();

-- ---------------------------------------------------------------------------
-- Notification type + settings (homework_reviewed)
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS homework_reviews BOOLEAN NOT NULL DEFAULT true;

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
    'homework_reviewed'
  ));

CREATE OR REPLACE FUNCTION public._create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_user_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_settings public.notification_settings%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public._ensure_notification_settings(p_user_id);
  SELECT * INTO v_settings FROM public.notification_settings WHERE user_id = p_user_id;

  IF p_type = 'friend_request' AND NOT COALESCE(v_settings.friend_requests, true) THEN
    RETURN NULL;
  ELSIF p_type = 'friend_level_up' AND NOT COALESCE(v_settings.friend_level_ups, true) THEN
    RETURN NULL;
  ELSIF p_type = 'kudos' AND NOT COALESCE(v_settings.kudos, true) THEN
    RETURN NULL;
  ELSIF p_type = 'announcement' AND NOT COALESCE(v_settings.announcements, true) THEN
    RETURN NULL;
  ELSIF p_type IN ('friend_game_challenge', 'friend_game_challenge_result')
    AND NOT COALESCE(v_settings.game_challenges, true) THEN
    RETURN NULL;
  ELSIF p_type = 'homework_reviewed' AND NOT COALESCE(v_settings.homework_reviews, true) THEN
    RETURN NULL;
  END IF;

  IF p_actor_user_id IS NOT NULL AND p_actor_user_id = p_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, actor_user_id, payload)
  VALUES (p_user_id, p_type, p_actor_user_id, COALESCE(p_payload, '{}'::JSONB))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_homework_reviewed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson_title TEXT;
  v_course_tier TEXT;
BEGIN
  IF OLD.status = 'pending_review' AND NEW.status = 'reviewed' THEN
    SELECT l.title, c.required_tier
    INTO v_lesson_title, v_course_tier
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = NEW.lesson_id;

    PERFORM public._create_notification(
      NEW.student_id,
      'homework_reviewed',
      NEW.reviewed_by,
      jsonb_build_object(
        'lesson_id', NEW.lesson_id,
        'lesson_title', v_lesson_title,
        'course_tier', v_course_tier,
        'approved', NEW.approved,
        'tutor_comment', NEW.tutor_comment
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_submission_notify_reviewed ON public.homework_submissions;
CREATE TRIGGER trg_homework_submission_notify_reviewed
  AFTER UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_homework_reviewed();

DROP FUNCTION IF EXISTS public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.update_notification_settings(
  p_friend_requests BOOLEAN,
  p_friend_level_ups BOOLEAN,
  p_kudos BOOLEAN,
  p_announcements BOOLEAN,
  p_game_challenges BOOLEAN DEFAULT NULL,
  p_homework_reviews BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notification_settings (
    user_id,
    friend_requests,
    friend_level_ups,
    kudos,
    announcements,
    game_challenges,
    homework_reviews,
    updated_at
  )
  VALUES (
    v_user,
    COALESCE(p_friend_requests, true),
    COALESCE(p_friend_level_ups, true),
    COALESCE(p_kudos, true),
    COALESCE(p_announcements, true),
    COALESCE(p_game_challenges, true),
    COALESCE(p_homework_reviews, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    friend_requests = COALESCE(p_friend_requests, notification_settings.friend_requests),
    friend_level_ups = COALESCE(p_friend_level_ups, notification_settings.friend_level_ups),
    kudos = COALESCE(p_kudos, notification_settings.kudos),
    announcements = COALESCE(p_announcements, notification_settings.announcements),
    game_challenges = COALESCE(p_game_challenges, notification_settings.game_challenges),
    homework_reviews = COALESCE(p_homework_reviews, notification_settings.homework_reviews),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own homework" ON public.homework_submissions;
CREATE POLICY "Students read own homework"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students insert own homework" ON public.homework_submissions;
CREATE POLICY "Students insert own homework"
  ON public.homework_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'pending_review'
    AND approved IS NULL
  );

DROP POLICY IF EXISTS "Tutors read student homework" ON public.homework_submissions;
CREATE POLICY "Tutors read student homework"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.tutor_teaches_student_for_lesson(
      auth.uid(),
      student_id,
      lesson_id
    )
  );

DROP POLICY IF EXISTS "Tutors review pending homework" ON public.homework_submissions;
CREATE POLICY "Tutors review pending homework"
  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (
    status = 'pending_review'
    AND (
      public.is_master_admin()
      OR public.tutor_teaches_student_for_lesson(
        auth.uid(),
        student_id,
        lesson_id
      )
    )
  )
  WITH CHECK (
    status = 'reviewed'
    AND (
      public.is_master_admin()
      OR public.tutor_teaches_student_for_lesson(
        auth.uid(),
        student_id,
        lesson_id
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.homework_submissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_teaches_student_for_lesson(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_homework_submission(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: homework-recordings (PRIVATE — signed URLs only)
-- Path: {lesson_id}/{student_id}/{timestamp}.{ext}
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-recordings', 'homework-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Students upload own homework recordings" ON storage.objects;
DROP POLICY IF EXISTS "Students read own homework recordings" ON storage.objects;
DROP POLICY IF EXISTS "Tutors read student homework recordings" ON storage.objects;
DROP POLICY IF EXISTS "Staff manage homework recordings" ON storage.objects;
DROP POLICY IF EXISTS "Read homework recordings" ON storage.objects;

CREATE POLICY "Students upload own homework recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-recordings'
    AND split_part(name, '/', 2) = auth.uid()::text
  );

CREATE POLICY "Read homework recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-recordings'
    AND (
      split_part(name, '/', 2) = auth.uid()::text
      OR public.is_master_admin()
      OR (
        public.is_tutor()
        AND public.tutor_teaches_student_for_lesson(
          auth.uid(),
          split_part(name, '/', 2)::uuid,
          split_part(name, '/', 1)::uuid
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
