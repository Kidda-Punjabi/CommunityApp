-- Kid-profile notification routing (schema columns already exist).
-- XOR: exactly one of user_id / kid_profile_id per row.
-- Kid-routed rows are always-on (no notification_settings.kid_profile_id yet).

CREATE INDEX IF NOT EXISTS idx_notifications_kid_created
  ON public.notifications (kid_profile_id, created_at DESC)
  WHERE kid_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_kid_unread
  ON public.notifications (kid_profile_id, created_at DESC)
  WHERE kid_profile_id IS NOT NULL AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public._create_kid_notification(
  p_kid_profile_id UUID,
  p_type TEXT,
  p_actor_user_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_kid_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, kid_profile_id, type, actor_user_id, payload)
  VALUES (NULL, p_kid_profile_id, p_type, p_actor_user_id, COALESCE(p_payload, '{}'::JSONB))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_student_event(
  p_user_id UUID,
  p_kid_profile_id UUID,
  p_type TEXT,
  p_actor_user_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent UUID;
BEGIN
  IF p_kid_profile_id IS NOT NULL THEN
    SELECT parent_user_id
    INTO v_parent
    FROM public.kid_profiles
    WHERE id = p_kid_profile_id;

    IF v_parent IS NULL THEN
      RETURN;
    END IF;

    -- both: parent (settings) + kid (always-on). kid_only: kid row only.
    IF p_type <> 'cohort_new_student' THEN
      PERFORM public._create_notification(
        v_parent,
        p_type,
        p_actor_user_id,
        COALESCE(p_payload, '{}'::JSONB)
      );
    END IF;

    PERFORM public._create_kid_notification(
      p_kid_profile_id,
      p_type,
      p_actor_user_id,
      COALESCE(p_payload, '{}'::JSONB)
    );
    RETURN;
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM public._create_notification(
      p_user_id,
      p_type,
      p_actor_user_id,
      COALESCE(p_payload, '{}'::JSONB)
    );
  END IF;
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
  v_payload JSONB;
BEGIN
  IF OLD.status = 'pending_review' AND NEW.status = 'reviewed' THEN
    SELECT l.title, c.required_tier
    INTO v_lesson_title, v_course_tier
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = NEW.lesson_id;

    v_payload := jsonb_build_object(
      'lesson_id', NEW.lesson_id,
      'lesson_title', v_lesson_title,
      'course_tier', v_course_tier,
      'approved', NEW.approved,
      'tutor_comment', NEW.tutor_comment
    );

    PERFORM public._notify_student_event(
      NEW.student_id,
      NEW.kid_profile_id,
      'homework_reviewed',
      NEW.reviewed_by,
      v_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'certificate_id', NEW.id,
    'level', NEW.level,
    'cefr_level', NEW.cefr_level,
    'course_enrollment_id', NEW.course_enrollment_id
  );

  PERFORM public._notify_student_event(
    NEW.profile_id,
    NEW.kid_profile_id,
    'certificate_issued',
    NEW.issued_by,
    v_payload
  );

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR kid_profile_id IN (
      SELECT kp.id
      FROM public.kid_profiles kp
      WHERE kp.parent_user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
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

  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND read_at IS NULL
    AND (
      user_id = v_user
      OR kid_profile_id IN (
        SELECT kp.id
        FROM public.kid_profiles kp
        WHERE kp.parent_user_id = v_user
      )
    );
END;
$$;

DROP FUNCTION IF EXISTS public.mark_all_notifications_read();

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_kid_profile_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INTEGER;
  v_kid UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_kid_profile_id IS NOT NULL THEN
    SELECT kp.id
    INTO v_kid
    FROM public.kid_profiles kp
    WHERE kp.id = p_kid_profile_id
      AND kp.parent_user_id = v_user;

    IF v_kid IS NULL THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.notifications
    SET read_at = now()
    WHERE kid_profile_id = v_kid
      AND read_at IS NULL;
  ELSE
    UPDATE public.notifications
    SET read_at = now()
    WHERE user_id = v_user
      AND read_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public._create_kid_notification(UUID, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public._notify_student_event(UUID, UUID, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
