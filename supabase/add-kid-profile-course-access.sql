-- =============================================================================
-- Kidda — Kid profile course access
-- Migration name: add_kid_profile_course_access
--
-- Extends course-delivery tables so a kid_profiles row can be the actor
-- instead of the parent user. Adult (user_id / student_id) rows stay valid.
--
-- Unique constraints keep adult onConflict keys (user_id / student_id).
-- Kid uniqueness is a second UNIQUE (kid_profile_id, …). NULLs do not collide,
-- which is safe because actor XOR guarantees exactly one of user_id /
-- kid_profile_id is set.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared: parent owns kid profile (RLS helper; same predicate as kid_stickers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.parent_owns_kid_profile(p_kid_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kid_profiles kp
    WHERE kp.id = p_kid_profile_id
      AND kp.parent_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.parent_owns_kid_profile(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. cohort_members  PK (cohort_id, user_id) → surrogate id
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_members
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.cohort_members
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.cohort_members SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.cohort_members
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.cohort_members DROP CONSTRAINT IF EXISTS cohort_members_pkey;

ALTER TABLE public.cohort_members
  ADD CONSTRAINT cohort_members_pkey PRIMARY KEY (id);

ALTER TABLE public.cohort_members
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.cohort_members DROP CONSTRAINT IF EXISTS cohort_members_cohort_user_key;
ALTER TABLE public.cohort_members
  ADD CONSTRAINT cohort_members_cohort_user_key UNIQUE (cohort_id, user_id);

ALTER TABLE public.cohort_members DROP CONSTRAINT IF EXISTS cohort_members_cohort_kid_key;
ALTER TABLE public.cohort_members
  ADD CONSTRAINT cohort_members_cohort_kid_key UNIQUE (cohort_id, kid_profile_id);

ALTER TABLE public.cohort_members DROP CONSTRAINT IF EXISTS cohort_members_actor_check;
ALTER TABLE public.cohort_members
  ADD CONSTRAINT cohort_members_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_cohort_members_kid_profile_id
  ON public.cohort_members (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. course_enrollments
-- ---------------------------------------------------------------------------

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.course_enrollments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_kid_course_key;
ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_kid_course_key UNIQUE (kid_profile_id, course_id);

ALTER TABLE public.course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_actor_check;
ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_course_enrollments_kid_profile_id
  ON public.course_enrollments (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. profile_course_access  PK (user_id, course_tier) → surrogate id
-- ---------------------------------------------------------------------------

ALTER TABLE public.profile_course_access
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.profile_course_access
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.profile_course_access SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.profile_course_access
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.profile_course_access DROP CONSTRAINT IF EXISTS profile_course_access_pkey;

ALTER TABLE public.profile_course_access
  ADD CONSTRAINT profile_course_access_pkey PRIMARY KEY (id);

ALTER TABLE public.profile_course_access
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.profile_course_access DROP CONSTRAINT IF EXISTS profile_course_access_user_tier_key;
ALTER TABLE public.profile_course_access
  ADD CONSTRAINT profile_course_access_user_tier_key UNIQUE (user_id, course_tier);

ALTER TABLE public.profile_course_access DROP CONSTRAINT IF EXISTS profile_course_access_kid_tier_key;
ALTER TABLE public.profile_course_access
  ADD CONSTRAINT profile_course_access_kid_tier_key UNIQUE (kid_profile_id, course_tier);

ALTER TABLE public.profile_course_access DROP CONSTRAINT IF EXISTS profile_course_access_actor_check;
ALTER TABLE public.profile_course_access
  ADD CONSTRAINT profile_course_access_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 4. student_packages
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_packages
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.student_packages
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.student_packages DROP CONSTRAINT IF EXISTS student_packages_kid_package_key;
ALTER TABLE public.student_packages
  ADD CONSTRAINT student_packages_kid_package_key UNIQUE (kid_profile_id, package_id);

ALTER TABLE public.student_packages DROP CONSTRAINT IF EXISTS student_packages_actor_check;
ALTER TABLE public.student_packages
  ADD CONSTRAINT student_packages_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_student_packages_kid_profile_id
  ON public.student_packages (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. homework_submissions
-- ---------------------------------------------------------------------------

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.homework_submissions
  ALTER COLUMN student_id DROP NOT NULL;

DROP INDEX IF EXISTS homework_submissions_one_formal_per_lesson;
CREATE UNIQUE INDEX homework_submissions_one_formal_per_lesson
  ON public.homework_submissions (lesson_id, student_id)
  WHERE is_practice = false AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS homework_submissions_one_formal_per_lesson_kid
  ON public.homework_submissions (lesson_id, kid_profile_id)
  WHERE is_practice = false AND kid_profile_id IS NOT NULL;

ALTER TABLE public.homework_submissions DROP CONSTRAINT IF EXISTS homework_submissions_actor_check;
ALTER TABLE public.homework_submissions
  ADD CONSTRAINT homework_submissions_actor_check
  CHECK ((student_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_homework_submissions_kid_profile_id
  ON public.homework_submissions (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. cohort_lesson_attendance + tutor_note
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_lesson_attendance
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.cohort_lesson_attendance
  ADD COLUMN IF NOT EXISTS tutor_note text;

ALTER TABLE public.cohort_lesson_attendance
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.cohort_lesson_attendance
  DROP CONSTRAINT IF EXISTS cohort_lesson_attendance_cohort_id_lesson_id_student_id_key;

ALTER TABLE public.cohort_lesson_attendance DROP CONSTRAINT IF EXISTS cohort_lesson_attendance_user_key;
ALTER TABLE public.cohort_lesson_attendance
  ADD CONSTRAINT cohort_lesson_attendance_user_key UNIQUE (cohort_id, lesson_id, student_id);

ALTER TABLE public.cohort_lesson_attendance DROP CONSTRAINT IF EXISTS cohort_lesson_attendance_kid_key;
ALTER TABLE public.cohort_lesson_attendance
  ADD CONSTRAINT cohort_lesson_attendance_kid_key UNIQUE (cohort_id, lesson_id, kid_profile_id);

ALTER TABLE public.cohort_lesson_attendance DROP CONSTRAINT IF EXISTS cohort_lesson_attendance_actor_check;
ALTER TABLE public.cohort_lesson_attendance
  ADD CONSTRAINT cohort_lesson_attendance_actor_check
  CHECK ((student_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

COMMENT ON COLUMN public.cohort_lesson_attendance.tutor_note IS
  'Optional tutor-written note for this student/lesson. Separate from homework_submissions.tutor_comment.';

-- ---------------------------------------------------------------------------
-- 7. cohort_lesson_homework
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohort_lesson_homework
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.cohort_lesson_homework
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.cohort_lesson_homework
  DROP CONSTRAINT IF EXISTS cohort_lesson_homework_cohort_id_lesson_id_student_id_key;

ALTER TABLE public.cohort_lesson_homework DROP CONSTRAINT IF EXISTS cohort_lesson_homework_user_key;
ALTER TABLE public.cohort_lesson_homework
  ADD CONSTRAINT cohort_lesson_homework_user_key UNIQUE (cohort_id, lesson_id, student_id);

ALTER TABLE public.cohort_lesson_homework DROP CONSTRAINT IF EXISTS cohort_lesson_homework_kid_key;
ALTER TABLE public.cohort_lesson_homework
  ADD CONSTRAINT cohort_lesson_homework_kid_key UNIQUE (cohort_id, lesson_id, kid_profile_id);

ALTER TABLE public.cohort_lesson_homework DROP CONSTRAINT IF EXISTS cohort_lesson_homework_actor_check;
ALTER TABLE public.cohort_lesson_homework
  ADD CONSTRAINT cohort_lesson_homework_actor_check
  CHECK ((student_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 8. lesson_progress
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.lesson_progress
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_kid_lesson_key;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_kid_lesson_key UNIQUE (kid_profile_id, lesson_id);

ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_actor_check;
ALTER TABLE public.lesson_progress
  ADD CONSTRAINT lesson_progress_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 9. quiz_progress
-- ---------------------------------------------------------------------------

ALTER TABLE public.quiz_progress
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.quiz_progress
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.quiz_progress DROP CONSTRAINT IF EXISTS quiz_progress_kid_quiz_key;
ALTER TABLE public.quiz_progress
  ADD CONSTRAINT quiz_progress_kid_quiz_key UNIQUE (kid_profile_id, quiz_id);

ALTER TABLE public.quiz_progress DROP CONSTRAINT IF EXISTS quiz_progress_actor_check;
ALTER TABLE public.quiz_progress
  ADD CONSTRAINT quiz_progress_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- 10. course_access  PK (user_id, course_id) → surrogate id
-- ---------------------------------------------------------------------------

ALTER TABLE public.course_access
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.course_access
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.course_access SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.course_access
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.course_access DROP CONSTRAINT IF EXISTS course_access_pkey;

ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_pkey PRIMARY KEY (id);

ALTER TABLE public.course_access
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.course_access DROP CONSTRAINT IF EXISTS course_access_user_course_key;
ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_user_course_key UNIQUE (user_id, course_id);

ALTER TABLE public.course_access DROP CONSTRAINT IF EXISTS course_access_kid_course_key;
ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_kid_course_key UNIQUE (kid_profile_id, course_id);

ALTER TABLE public.course_access DROP CONSTRAINT IF EXISTS course_access_actor_check;
ALTER TABLE public.course_access
  ADD CONSTRAINT course_access_actor_check
  CHECK ((user_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_course_access_kid_profile_id
  ON public.course_access (kid_profile_id)
  WHERE kid_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 11. student_lesson_unlocks  PK (student_id, lesson_id) → surrogate id
-- ---------------------------------------------------------------------------

ALTER TABLE public.student_lesson_unlocks
  ADD COLUMN IF NOT EXISTS kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE;

ALTER TABLE public.student_lesson_unlocks
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.student_lesson_unlocks SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.student_lesson_unlocks
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.student_lesson_unlocks DROP CONSTRAINT IF EXISTS student_lesson_unlocks_pkey;

ALTER TABLE public.student_lesson_unlocks
  ADD CONSTRAINT student_lesson_unlocks_pkey PRIMARY KEY (id);

ALTER TABLE public.student_lesson_unlocks
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.student_lesson_unlocks DROP CONSTRAINT IF EXISTS student_lesson_unlocks_user_lesson_key;
ALTER TABLE public.student_lesson_unlocks
  ADD CONSTRAINT student_lesson_unlocks_user_lesson_key UNIQUE (student_id, lesson_id);

ALTER TABLE public.student_lesson_unlocks DROP CONSTRAINT IF EXISTS student_lesson_unlocks_kid_lesson_key;
ALTER TABLE public.student_lesson_unlocks
  ADD CONSTRAINT student_lesson_unlocks_kid_lesson_key UNIQUE (kid_profile_id, lesson_id);

ALTER TABLE public.student_lesson_unlocks DROP CONSTRAINT IF EXISTS student_lesson_unlocks_actor_check;
ALTER TABLE public.student_lesson_unlocks
  ADD CONSTRAINT student_lesson_unlocks_actor_check
  CHECK ((student_id IS NOT NULL) <> (kid_profile_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- Queue: kids purchase completed before parent account exists
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kids_course_purchase_grant_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id text NOT NULL UNIQUE,
  parent_email text,
  parent_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  kid_name text,
  kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE SET NULL,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL,
  reason text NOT NULL,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kids_course_purchase_grant_queue_open
  ON public.kids_course_purchase_grant_queue (created_at DESC)
  WHERE resolved = false;

ALTER TABLE public.kids_course_purchase_grant_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read kids purchase grant queue"
  ON public.kids_course_purchase_grant_queue;
CREATE POLICY "Staff read kids purchase grant queue"
  ON public.kids_course_purchase_grant_queue FOR SELECT TO authenticated
  USING (public.is_master_admin() OR public.is_community_lead());

GRANT SELECT ON public.kids_course_purchase_grant_queue TO authenticated;
GRANT ALL ON public.kids_course_purchase_grant_queue TO service_role;

-- ---------------------------------------------------------------------------
-- Triggers: branch on actor; allow content_track = 'kids'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_cohort_beginners_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
  v_track TEXT;
BEGIN
  SELECT c.required_tier, c.content_track INTO v_tier, v_track
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF COALESCE(v_track, '') = 'kids' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_tier, '') <> 'beginners' THEN
    RAISE EXCEPTION 'Cohorts are only allowed for Beginners courses (course_id %).', NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_course_enrollment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
  v_track TEXT;
  v_member_ok BOOLEAN;
BEGIN
  SELECT c.required_tier, c.content_track INTO v_tier, v_track
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF COALESCE(v_tier, '') = 'community' AND COALESCE(v_track, '') IS DISTINCT FROM 'kids' THEN
    RAISE EXCEPTION 'Community course does not use course_enrollments.';
  END IF;

  IF COALESCE(v_tier, '') = 'foundational' AND COALESCE(v_track, '') IS DISTINCT FROM 'kids' THEN
    IF NEW.delivery_mode IS NOT NULL AND NEW.delivery_mode <> 'one_to_one'::public.delivery_mode THEN
      RAISE EXCEPTION 'Foundational enrollments only allow delivery_mode one_to_one or null.';
    END IF;
    IF NEW.cohort_id IS NOT NULL THEN
      RAISE EXCEPTION 'Foundational enrollments must not set cohort_id.';
    END IF;
  END IF;

  IF COALESCE(v_tier, '') = 'beginners' OR COALESCE(v_track, '') = 'kids' THEN
    IF COALESCE(v_tier, '') = 'beginners' AND COALESCE(v_track, '') IS DISTINCT FROM 'kids' THEN
      IF NEW.delivery_mode IS NULL THEN
        RAISE EXCEPTION 'Beginners enrollments require delivery_mode.';
      END IF;

      IF NEW.delivery_mode = 'one_to_one'::public.delivery_mode THEN
        IF NEW.cohort_id IS NOT NULL THEN
          RAISE EXCEPTION 'Beginners 1-1 enrollments must not set cohort_id.';
        END IF;
      END IF;
    END IF;

    IF NEW.delivery_mode = 'group'::public.delivery_mode THEN
      IF NEW.cohort_id IS NULL THEN
        RAISE EXCEPTION 'Group enrollments require cohort_id.';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.cohorts co
        WHERE co.id = NEW.cohort_id
          AND co.course_id = NEW.course_id
      ) THEN
        RAISE EXCEPTION 'cohort_id must belong to the same course.';
      END IF;

      IF NEW.user_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.cohort_members cm
          WHERE cm.cohort_id = NEW.cohort_id
            AND cm.user_id = NEW.user_id
            AND cm.left_at IS NULL
        ) INTO v_member_ok;
      ELSE
        SELECT EXISTS (
          SELECT 1
          FROM public.cohort_members cm
          WHERE cm.cohort_id = NEW.cohort_id
            AND cm.kid_profile_id = NEW.kid_profile_id
            AND cm.left_at IS NULL
        ) INTO v_member_ok;
      END IF;

      IF NOT v_member_ok THEN
        RAISE EXCEPTION 'Student must be an active member of cohort_id.';
      END IF;
    END IF;
  END IF;

  IF NOT public.is_tutor() AND NOT public.is_master_admin() AND TG_OP = 'INSERT' THEN
    NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_homework_submission_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
  v_track TEXT;
BEGIN
  SELECT c.required_tier, c.content_track INTO v_tier, v_track
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = NEW.lesson_id;

  IF COALESCE(v_track, '') = 'kids' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF COALESCE(v_tier, '') NOT IN ('foundational', 'beginners') THEN
    RAISE EXCEPTION 'Homework submissions are only allowed for Foundational and Beginners courses.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Access helpers: honour active kid_session_context
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.active_kid_profile_id_for(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ksc.active_kid_profile_id
  FROM public.kid_session_context ksc
  JOIN public.kid_profiles kp
    ON kp.id = ksc.active_kid_profile_id
   AND kp.parent_user_id = p_user_id
  WHERE ksc.user_id = p_user_id
    AND ksc.active_kid_profile_id IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.active_kid_profile_id_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_course_access(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.active_kid_profile_id_for(p_user_id) IS NOT NULL THEN
        EXISTS (
          SELECT 1
          FROM public.course_access ca
          WHERE ca.kid_profile_id = public.active_kid_profile_id_for(p_user_id)
            AND ca.course_id = p_course_id
        )
      ELSE
        EXISTS (
          SELECT 1
          FROM public.course_access ca
          WHERE ca.user_id = p_user_id
            AND ca.course_id = p_course_id
        )
    END;
$$;

CREATE OR REPLACE FUNCTION public.is_lesson_content_unlocked(
  p_user_id UUID,
  p_lesson_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_tier TEXT;
  v_course_name TEXT;
  v_track TEXT;
  v_is_free BOOLEAN;
  v_enrollment public.course_enrollments%ROWTYPE;
  v_kid_id UUID;
BEGIN
  v_kid_id := public.active_kid_profile_id_for(p_user_id);

  SELECT l.course_id, l.is_free, c.required_tier, c.name, c.content_track
  INTO v_course_id, v_is_free, v_tier, v_course_name, v_track
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_is_free, false) THEN
    RETURN true;
  END IF;

  IF NOT public.user_has_course_access(p_user_id, v_course_id) THEN
    RETURN false;
  END IF;

  IF COALESCE(v_tier, '') = 'community' OR COALESCE(v_course_name, '') ILIKE '%community%' THEN
    RETURN true;
  END IF;

  IF v_kid_id IS NOT NULL THEN
    SELECT * INTO v_enrollment
    FROM public.course_enrollments ce
    WHERE ce.kid_profile_id = v_kid_id
      AND ce.course_id = v_course_id;
  ELSE
    SELECT * INTO v_enrollment
    FROM public.course_enrollments ce
    WHERE ce.user_id = p_user_id
      AND ce.course_id = v_course_id;
  END IF;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_enrollment.delivery_mode = 'group'::public.delivery_mode THEN
    IF v_kid_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.cohort_lesson_unlocks clu
        JOIN public.cohort_members cm
          ON cm.cohort_id = clu.cohort_id
         AND cm.kid_profile_id = v_kid_id
         AND cm.left_at IS NULL
        WHERE clu.cohort_id = v_enrollment.cohort_id
          AND clu.lesson_id = p_lesson_id
      );
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.cohort_lesson_unlocks clu
      JOIN public.cohort_members cm
        ON cm.cohort_id = clu.cohort_id
       AND cm.user_id = p_user_id
       AND cm.left_at IS NULL
      WHERE clu.cohort_id = v_enrollment.cohort_id
        AND clu.lesson_id = p_lesson_id
    );
  END IF;

  IF v_kid_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.student_lesson_unlocks slu
      WHERE slu.kid_profile_id = v_kid_id
        AND slu.lesson_id = p_lesson_id
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.student_lesson_unlocks slu
    WHERE slu.student_id = p_user_id
      AND slu.lesson_id = p_lesson_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_lesson_recording(
  p_user_id UUID,
  p_recording_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec public.lesson_recordings%ROWTYPE;
  v_kid_id UUID;
BEGIN
  v_kid_id := public.active_kid_profile_id_for(p_user_id);

  SELECT * INTO v_rec
  FROM public.lesson_recordings lr
  WHERE lr.id = p_recording_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT public.is_lesson_content_unlocked(p_user_id, v_rec.lesson_id) THEN
    RETURN false;
  END IF;

  IF v_rec.student_id IS NOT NULL THEN
    RETURN v_rec.student_id = p_user_id;
  END IF;

  IF v_kid_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.cohort_members cm
      WHERE cm.cohort_id = v_rec.cohort_id
        AND cm.kid_profile_id = v_kid_id
        AND cm.left_at IS NULL
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.cohort_members cm
    WHERE cm.cohort_id = v_rec.cohort_id
      AND cm.user_id = p_user_id
      AND cm.left_at IS NULL
  );
END;
$$;

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
  SELECT
    p_student_id IS NOT NULL
    AND (
      EXISTS (
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
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.tutor_teaches_kid_for_lesson(
  p_tutor_id UUID,
  p_kid_profile_id UUID,
  p_lesson_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_kid_profile_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.course_enrollments ce
        JOIN public.lessons l ON l.id = p_lesson_id
        WHERE ce.kid_profile_id = p_kid_profile_id
          AND ce.course_id = l.course_id
          AND ce.tutor_id = p_tutor_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.cohort_members cm
        JOIN public.cohorts co ON co.id = cm.cohort_id
        JOIN public.lessons l ON l.id = p_lesson_id
        WHERE cm.kid_profile_id = p_kid_profile_id
          AND cm.left_at IS NULL
          AND co.tutor_id = p_tutor_id
          AND l.course_id = co.course_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_teaches_kid_for_lesson(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_can_access_student_package(p_student_package_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_packages sp
    LEFT JOIN public.course_enrollments ce_by_id
      ON ce_by_id.id = sp.enrollment_id
    LEFT JOIN public.course_enrollments ce_by_course
      ON ce_by_course.user_id = sp.user_id
     AND ce_by_course.course_id = sp.course_id
     AND sp.user_id IS NOT NULL
    LEFT JOIN public.course_enrollments ce_by_kid
      ON ce_by_kid.kid_profile_id = sp.kid_profile_id
     AND ce_by_kid.course_id = sp.course_id
     AND sp.kid_profile_id IS NOT NULL
    LEFT JOIN public.package_instances pi
      ON pi.id = sp.package_instance_id
    WHERE sp.id = p_student_package_id
      AND (
        ce_by_id.tutor_id = auth.uid()
        OR ce_by_course.tutor_id = auth.uid()
        OR ce_by_kid.tutor_id = auth.uid()
        OR pi.tutor_id = auth.uid()
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- complete_group_purchase_core: optional kid actor (adult path unchanged)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_group_purchase_core(
  p_user_id uuid,
  p_student_package_id uuid,
  p_cohort_id uuid,
  p_hold_id uuid,
  p_purchased_at timestamptz,
  p_payment_date date,
  p_stripe_session_id text,
  p_stripe_payment_intent text DEFAULT NULL,
  p_kid_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp public.student_packages%ROWTYPE;
  v_pkg_delivery text;
  v_hold public.cohort_seat_holds%ROWTYPE;
  v_cohort public.cohorts%ROWTYPE;
  v_enrollment_id uuid;
  v_checklist_id uuid;
  v_existing_cohort_id uuid;
BEGIN
  IF p_kid_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.kid_profiles kp
      WHERE kp.id = p_kid_profile_id
        AND kp.parent_user_id = p_user_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Kid profile does not belong to this parent.');
    END IF;
  END IF;

  SELECT sp.*
  INTO v_sp
  FROM public.student_packages sp
  WHERE sp.id = p_student_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student package not found.');
  END IF;

  IF p_kid_profile_id IS NOT NULL THEN
    IF v_sp.kid_profile_id IS DISTINCT FROM p_kid_profile_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Student package mismatch.');
    END IF;
  ELSE
    IF v_sp.user_id <> p_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Student package mismatch.');
    END IF;
  END IF;

  SELECT p.delivery_mode::text
  INTO v_pkg_delivery
  FROM public.packages p
  WHERE p.id = v_sp.package_id;

  IF v_pkg_delivery IS DISTINCT FROM 'group' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a group package.');
  END IF;

  IF v_sp.status = 'confirmed' AND v_sp.enrollment_id IS NOT NULL THEN
    SELECT ce.cohort_id
    INTO v_existing_cohort_id
    FROM public.course_enrollments ce
    WHERE ce.id = v_sp.enrollment_id;

    IF v_existing_cohort_id IS NOT DISTINCT FROM p_cohort_id THEN
      RETURN jsonb_build_object(
        'ok',
        true,
        'already_completed',
        true,
        'enrollment_id',
        v_sp.enrollment_id
      );
    END IF;
  END IF;

  SELECT *
  INTO v_hold
  FROM public.cohort_seat_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_hold.user_id <> p_user_id
    OR v_hold.cohort_id <> p_cohort_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cohort seat hold is invalid for this checkout.');
  END IF;

  SELECT *
  INTO v_cohort
  FROM public.cohorts
  WHERE id = p_cohort_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cohort not found.');
  END IF;

  IF p_kid_profile_id IS NOT NULL THEN
    UPDATE public.cohort_members cm
    SET left_at = COALESCE(cm.left_at, p_purchased_at)
    FROM public.cohorts c
    WHERE cm.kid_profile_id = p_kid_profile_id
      AND cm.cohort_id <> p_cohort_id
      AND cm.left_at IS NULL
      AND c.id = cm.cohort_id
      AND c.course_id = v_cohort.course_id;

    INSERT INTO public.cohort_members (cohort_id, user_id, kid_profile_id, joined_at, left_at)
    VALUES (p_cohort_id, NULL, p_kid_profile_id, p_purchased_at, NULL)
    ON CONFLICT (cohort_id, kid_profile_id) DO UPDATE
    SET joined_at = EXCLUDED.joined_at,
        left_at = NULL;

    INSERT INTO public.course_enrollments (
      user_id,
      kid_profile_id,
      course_id,
      tutor_id,
      delivery_mode,
      cohort_id,
      student_package_id,
      updated_at
    )
    VALUES (
      NULL,
      p_kid_profile_id,
      v_cohort.course_id,
      v_cohort.tutor_id,
      'group'::public.delivery_mode,
      p_cohort_id,
      p_student_package_id,
      p_purchased_at
    )
    ON CONFLICT (kid_profile_id, course_id) DO UPDATE
    SET tutor_id = EXCLUDED.tutor_id,
        delivery_mode = EXCLUDED.delivery_mode,
        cohort_id = EXCLUDED.cohort_id,
        student_package_id = EXCLUDED.student_package_id,
        updated_at = EXCLUDED.updated_at
    RETURNING id INTO v_enrollment_id;
  ELSE
    UPDATE public.cohort_members cm
    SET left_at = COALESCE(cm.left_at, p_purchased_at)
    FROM public.cohorts c
    WHERE cm.user_id = p_user_id
      AND cm.cohort_id <> p_cohort_id
      AND cm.left_at IS NULL
      AND c.id = cm.cohort_id
      AND c.course_id = v_cohort.course_id;

    INSERT INTO public.cohort_members (cohort_id, user_id, joined_at, left_at)
    VALUES (p_cohort_id, p_user_id, p_purchased_at, NULL)
    ON CONFLICT (cohort_id, user_id) DO UPDATE
    SET joined_at = EXCLUDED.joined_at,
        left_at = NULL;

    INSERT INTO public.course_enrollments (
      user_id,
      course_id,
      tutor_id,
      delivery_mode,
      cohort_id,
      student_package_id,
      updated_at
    )
    VALUES (
      p_user_id,
      v_cohort.course_id,
      v_cohort.tutor_id,
      'group'::public.delivery_mode,
      p_cohort_id,
      p_student_package_id,
      p_purchased_at
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET tutor_id = EXCLUDED.tutor_id,
        delivery_mode = EXCLUDED.delivery_mode,
        cohort_id = EXCLUDED.cohort_id,
        student_package_id = EXCLUDED.student_package_id,
        updated_at = EXCLUDED.updated_at
    RETURNING id INTO v_enrollment_id;
  END IF;

  UPDATE public.student_packages
  SET status = 'confirmed',
      enrollment_id = v_enrollment_id,
      last_stripe_checkout_session_id = p_stripe_session_id,
      purchased_at = p_purchased_at
  WHERE id = p_student_package_id;

  DELETE FROM public.cohort_seat_holds
  WHERE id = p_hold_id;

  SELECT id INTO v_checklist_id
  FROM public.onboarding_checklists
  WHERE student_package_id = p_student_package_id;

  IF v_checklist_id IS NOT NULL THEN
    UPDATE public.onboarding_checklists
    SET checklist_type = 'group',
        payment_date = p_payment_date,
        time_assigned = true,
        package_created = true
    WHERE id = v_checklist_id;
  ELSE
    INSERT INTO public.onboarding_checklists (
      student_package_id,
      checklist_type,
      payment_date,
      time_assigned,
      package_created,
      welcome_email,
      calendar_invite,
      tutor_notified,
      whatsapp_chat_made,
      schedule_whatsapp_chat,
      onboarding_completed
    )
    VALUES (
      p_student_package_id,
      'group',
      p_payment_date,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',
    true,
    'enrollment_id',
    v_enrollment_id,
    'cohort_name',
    v_cohort.name,
    'notion_page_id',
    v_cohort.notion_page_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

DROP FUNCTION IF EXISTS public.complete_group_purchase_core(uuid, uuid, uuid, uuid, timestamptz, date, text, text);

GRANT EXECUTE ON FUNCTION public.complete_group_purchase_core(
  uuid, uuid, uuid, uuid, timestamptz, date, text, text, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: extend adult policies with parent-of-kid OR clause
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Read cohort membership" ON public.cohort_members;
CREATE POLICY "Read cohort membership"
  ON public.cohort_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
    OR public.is_master_admin()
    OR public.tutor_can_manage_cohort(cohort_id)
  );

DROP POLICY IF EXISTS "Read own enrollment" ON public.course_enrollments;
CREATE POLICY "Read own enrollment"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
    OR tutor_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Users can read own course access" ON public.course_access;
CREATE POLICY "Users can read own course access"
  ON public.course_access FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Users can read own course access" ON public.profile_course_access;
CREATE POLICY "Users can read own course access"
  ON public.profile_course_access FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Students read own packages" ON public.student_packages;
CREATE POLICY "Students read own packages"
  ON public.student_packages FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Students read own homework" ON public.homework_submissions;
CREATE POLICY "Students read own homework"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Students insert own homework" ON public.homework_submissions;
CREATE POLICY "Students insert own homework"
  ON public.homework_submissions FOR INSERT TO authenticated
  WITH CHECK (
    (
      student_id = auth.uid()
      OR public.parent_owns_kid_profile(kid_profile_id)
    )
    AND status = 'pending_review'
    AND approved IS NULL
  );

DROP POLICY IF EXISTS "Tutors read student homework" ON public.homework_submissions;
CREATE POLICY "Tutors read student homework"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.tutor_teaches_student_for_lesson(auth.uid(), student_id, lesson_id)
    OR public.tutor_teaches_kid_for_lesson(auth.uid(), kid_profile_id, lesson_id)
  );

DROP POLICY IF EXISTS "Tutors review pending homework" ON public.homework_submissions;
CREATE POLICY "Tutors review pending homework"
  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (
    status = 'pending_review'
    AND (
      public.is_master_admin()
      OR public.tutor_teaches_student_for_lesson(auth.uid(), student_id, lesson_id)
      OR public.tutor_teaches_kid_for_lesson(auth.uid(), kid_profile_id, lesson_id)
    )
  )
  WITH CHECK (
    status = 'reviewed'
    AND (
      public.is_master_admin()
      OR public.tutor_teaches_student_for_lesson(auth.uid(), student_id, lesson_id)
      OR public.tutor_teaches_kid_for_lesson(auth.uid(), kid_profile_id, lesson_id)
    )
  );

DROP POLICY IF EXISTS "Students read own attendance" ON public.cohort_lesson_attendance;
CREATE POLICY "Students read own attendance"
  ON public.cohort_lesson_attendance FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Students read own homework marks" ON public.cohort_lesson_homework;
CREATE POLICY "Students read own homework marks"
  ON public.cohort_lesson_homework FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Users manage own lesson progress" ON public.lesson_progress;
CREATE POLICY "Users manage own lesson progress"
  ON public.lesson_progress FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Users manage own quiz progress" ON public.quiz_progress;
CREATE POLICY "Users manage own quiz progress"
  ON public.quiz_progress FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
  );

DROP POLICY IF EXISTS "Read student unlocks" ON public.student_lesson_unlocks;
CREATE POLICY "Read student unlocks"
  ON public.student_lesson_unlocks FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.parent_owns_kid_profile(kid_profile_id)
    OR public.is_master_admin()
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.user_id = student_lesson_unlocks.student_id
        AND ce.tutor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.kid_profile_id = student_lesson_unlocks.kid_profile_id
        AND ce.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff read cohorts" ON public.cohorts;
CREATE POLICY "Staff read cohorts"
  ON public.cohorts FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.tutor_can_manage_cohort(id)
    OR EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = id
        AND cm.left_at IS NULL
        AND (
          cm.user_id = auth.uid()
          OR public.parent_owns_kid_profile(cm.kid_profile_id)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
