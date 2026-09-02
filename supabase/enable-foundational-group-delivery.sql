-- Enable group delivery for the Foundational Course.
-- Mirrors existing Beginners group validation (cohort_id + active cohort_members).
-- Does not modify the existing 'foundational' package row (slug or delivery_mode).

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

  IF COALESCE(v_tier, '') NOT IN ('beginners', 'foundational') THEN
    RAISE EXCEPTION
      'Cohorts are only allowed for Beginners and Foundational courses (course_id %, required_tier %).',
      NEW.course_id,
      COALESCE(v_tier, 'null');
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
  -- Counter-only updates (session_switches_used, extra_reschedule_allowance, etc.)
  -- must not re-validate cohort membership; that check is for assignment changes.
  IF TG_OP = 'UPDATE'
     AND NEW.course_id IS NOT DISTINCT FROM OLD.course_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NEW.kid_profile_id IS NOT DISTINCT FROM OLD.kid_profile_id
     AND NEW.cohort_id IS NOT DISTINCT FROM OLD.cohort_id
     AND NEW.delivery_mode IS NOT DISTINCT FROM OLD.delivery_mode
  THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT c.required_tier, c.content_track INTO v_tier, v_track
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF COALESCE(v_tier, '') = 'community' AND COALESCE(v_track, '') IS DISTINCT FROM 'kids' THEN
    RAISE EXCEPTION 'Community course does not use course_enrollments.';
  END IF;

  IF COALESCE(v_tier, '') = 'foundational' AND COALESCE(v_track, '') IS DISTINCT FROM 'kids' THEN
    IF NEW.delivery_mode IS NULL OR NEW.delivery_mode = 'one_to_one'::public.delivery_mode THEN
      IF NEW.cohort_id IS NOT NULL THEN
        RAISE EXCEPTION 'Foundational enrollments must not set cohort_id.';
      END IF;
    ELSIF NEW.delivery_mode = 'group'::public.delivery_mode THEN
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
    ELSE
      RAISE EXCEPTION 'Foundational enrollments only allow delivery_mode one_to_one, group, or null.';
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

INSERT INTO public.packages (
  slug,
  name,
  description,
  course_id,
  delivery_mode,
  includes_live_sessions,
  active,
  display_order
)
SELECT
  'foundational-group',
  'Foundational Course (Group)',
  'Small-group Foundational lessons on a fixed weekly schedule.',
  c.id,
  'group'::public.delivery_mode,
  true,
  true,
  COALESCE(
    (SELECT MAX(p.display_order) FROM public.packages p WHERE p.course_id = c.id),
    0
  ) + 1
FROM public.courses c
WHERE c.required_tier = 'foundational'
  AND COALESCE(c.content_track, '') IS DISTINCT FROM 'kids'
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
