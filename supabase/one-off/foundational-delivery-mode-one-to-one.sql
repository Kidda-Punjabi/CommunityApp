-- Allow explicit one_to_one delivery_mode on foundational enrollments (1-1 tutoring).
-- Still forbid group/cohort on foundational.

CREATE OR REPLACE FUNCTION public.enforce_course_enrollment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT c.required_tier INTO v_tier
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF COALESCE(v_tier, '') = 'community' THEN
    RAISE EXCEPTION 'Community course does not use course_enrollments.';
  END IF;

  IF COALESCE(v_tier, '') = 'foundational' THEN
    IF NEW.delivery_mode IS NOT NULL AND NEW.delivery_mode <> 'one_to_one'::public.delivery_mode THEN
      RAISE EXCEPTION 'Foundational enrollments only allow delivery_mode one_to_one or null.';
    END IF;
    IF NEW.cohort_id IS NOT NULL THEN
      RAISE EXCEPTION 'Foundational enrollments must not set cohort_id.';
    END IF;
  END IF;

  IF COALESCE(v_tier, '') = 'beginners' THEN
    IF NEW.delivery_mode IS NULL THEN
      RAISE EXCEPTION 'Beginners enrollments require delivery_mode.';
    END IF;

    IF NEW.delivery_mode = 'one_to_one'::public.delivery_mode THEN
      IF NEW.cohort_id IS NOT NULL THEN
        RAISE EXCEPTION 'Beginners 1-1 enrollments must not set cohort_id.';
      END IF;
    END IF;

    IF NEW.delivery_mode = 'group'::public.delivery_mode THEN
      IF NEW.cohort_id IS NULL THEN
        RAISE EXCEPTION 'Beginners group enrollments require cohort_id.';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.cohorts co
        WHERE co.id = NEW.cohort_id
          AND co.course_id = NEW.course_id
      ) THEN
        RAISE EXCEPTION 'cohort_id must belong to the same Beginners course.';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.cohort_members cm
        WHERE cm.cohort_id = NEW.cohort_id
          AND cm.user_id = NEW.user_id
          AND cm.left_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Student must be an active member of cohort_id.';
      END IF;
    END IF;
  END IF;

  IF NOT public.is_tutor() AND NOT public.is_master_admin() AND TG_OP = 'INSERT' THEN
    -- Allow service_role / migration; app uses staff RPCs
    NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
