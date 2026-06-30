-- =============================================================================
-- Kidda — Package instances + schema fixes (follow-up to cohort-package-management-revamp.sql)
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
--
-- Addresses team decisions:
--   1. Cohorts ≠ package instances — cohorts stay group-only; 1-1/small-group uses package_instances.
--   2. Cancelled memberships → new enum value 'withdrawn' (not 'interested').
--   3. Cohorts are always group — drop redundant delivery_mode column.
--   4. Tutors can read/update onboarding checklists for their own students.
--   5. Keep trg_cohorts_beginners_only; group packages use cohorts, not package_instances.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- #2: Add 'withdrawn' for cancelled / lapsed memberships (future-safe)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'package_membership_status'
      AND e.enumlabel = 'withdrawn'
  ) THEN
    ALTER TYPE public.package_membership_status ADD VALUE 'withdrawn';
  END IF;
END $$;

COMMENT ON TYPE public.package_membership_status IS
  'A person''s relationship to a purchased package (student_packages row). interested = lead or pending setup; waiting_for_payment = awaiting checkout; confirmed = active member; withdrawn = cancelled or removed from the run (historical). Instance lifecycle (paused, completed, etc.) lives on cohorts.status or package_instances.status.';

-- ---------------------------------------------------------------------------
-- #1 & #3: Clarify cohorts (group only) — remove delivery_mode
-- ---------------------------------------------------------------------------

COMMENT ON TYPE public.package_instance_status IS
  'Shared lifecycle status for a scheduled delivery run — used on cohorts (group) and package_instances (1-1 / small-group). UI groups: To-do (pre_scheduling, recruiting, scheduled), In progress (in_progress, paused), Complete (postponed, incomplete, classes_completed, offboarding_complete). Manually set — no automatic transitions.';

COMMENT ON TABLE public.cohorts IS
  'Group cohorts for group-format packages (e.g. Beginners group). One row = one scheduled group run with tutor, capacity, and lifecycle status. Not used for 1-1 packages — those use package_instances. Not used for Community.';

COMMENT ON COLUMN public.cohorts.capacity IS
  'Max students in this group cohort. Default 7; editable per cohort.';

COMMENT ON COLUMN public.cohorts.status IS
  'Lifecycle status for this group cohort (package_instance_status enum).';

ALTER TABLE public.cohorts
  DROP COLUMN IF EXISTS delivery_mode;

-- ---------------------------------------------------------------------------
-- #1: package_instances — 1-1 and small-group runs (NOT cohorts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.package_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages (id) ON DELETE RESTRICT,
  course_id uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  tutor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  name text NOT NULL,
  status public.package_instance_status NOT NULL DEFAULT 'pre_scheduling',
  start_day_of_week text
    CHECK (
      start_day_of_week IS NULL
      OR start_day_of_week = ANY (
        ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
      )
    ),
  start_date timestamptz,
  end_date timestamptz,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.package_instances IS
  'Scheduled runs for non-cohort packages (1-1 and small-group). Group-format packages use the cohorts table instead. Links to the sellable package catalog via package_id.';

COMMENT ON COLUMN public.package_instances.capacity IS
  'Max students on this instance. Default 1 for 1-1; may be 2-3 for small-group runs that are not a full cohort.';

COMMENT ON COLUMN public.package_instances.status IS
  'Lifecycle status (package_instance_status enum). Paused/completed tracked here, not on individual student_packages rows.';

CREATE INDEX IF NOT EXISTS idx_package_instances_package_id
  ON public.package_instances (package_id);

CREATE INDEX IF NOT EXISTS idx_package_instances_course_id
  ON public.package_instances (course_id);

CREATE INDEX IF NOT EXISTS idx_package_instances_tutor_id
  ON public.package_instances (tutor_id)
  WHERE tutor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_package_instance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_instances_updated_at ON public.package_instances;
CREATE TRIGGER trg_package_instances_updated_at
  BEFORE UPDATE ON public.package_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_package_instance_updated_at();

-- #5: Group packages must use cohorts; package_instances only for non-group packages.
CREATE OR REPLACE FUNCTION public.enforce_package_instance_not_group()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_delivery_mode public.delivery_mode;
BEGIN
  SELECT p.delivery_mode INTO v_delivery_mode
  FROM public.packages p
  WHERE p.id = NEW.package_id;

  IF v_delivery_mode = 'group'::public.delivery_mode THEN
    RAISE EXCEPTION
      'Group-format packages use cohorts, not package_instances (package_id %).',
      NEW.package_id;
  END IF;

  IF NEW.course_id IS DISTINCT FROM (
    SELECT p.course_id FROM public.packages p WHERE p.id = NEW.package_id
  ) THEN
    RAISE EXCEPTION 'package_instances.course_id must match packages.course_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_instances_not_group ON public.package_instances;
CREATE TRIGGER trg_package_instances_not_group
  BEFORE INSERT OR UPDATE OF package_id, course_id ON public.package_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_package_instance_not_group();

-- Link student_packages to a 1-1 / small-group instance when assigned
ALTER TABLE public.student_packages
  ADD COLUMN IF NOT EXISTS package_instance_id uuid
    REFERENCES public.package_instances (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.student_packages.package_instance_id IS
  'Set when this member is assigned to a 1-1 or small-group package_instance. Group members use cohort_id on course_enrollments instead.';

CREATE INDEX IF NOT EXISTS idx_student_packages_package_instance_id
  ON public.student_packages (package_instance_id)
  WHERE package_instance_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: package_instances
-- ---------------------------------------------------------------------------

ALTER TABLE public.package_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read package instances" ON public.package_instances;
CREATE POLICY "Staff read package instances"
  ON public.package_instances FOR SELECT TO authenticated
  USING (
    public.is_community_lead()
    OR tutor_id = auth.uid()
    OR public.is_tutor()
  );

DROP POLICY IF EXISTS "Staff manage package instances" ON public.package_instances;
CREATE POLICY "Staff manage package instances"
  ON public.package_instances FOR ALL TO authenticated
  USING (
    public.is_community_lead()
    OR tutor_id = auth.uid()
  )
  WITH CHECK (
    public.is_community_lead()
    OR tutor_id = auth.uid()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_instances TO authenticated;

-- ---------------------------------------------------------------------------
-- #4: Tutor access to onboarding_checklists for their students
-- ---------------------------------------------------------------------------

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
    WHERE sp.id = p_student_package_id
      AND (
        ce_by_id.tutor_id = auth.uid()
        OR ce_by_course.tutor_id = auth.uid()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_access_student_package(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins and community leads can manage onboarding checklists"
  ON public.onboarding_checklists;

DROP POLICY IF EXISTS "Staff manage onboarding checklists" ON public.onboarding_checklists;
CREATE POLICY "Staff manage onboarding checklists"
  ON public.onboarding_checklists
  FOR ALL
  TO authenticated
  USING (
    public.is_community_lead()
    OR (
      public.is_tutor()
      AND public.tutor_can_access_student_package(student_package_id)
    )
  )
  WITH CHECK (
    public.is_community_lead()
    OR (
      public.is_tutor()
      AND public.tutor_can_access_student_package(student_package_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== cohorts (delivery_mode should be gone) ===';
  FOR r IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cohorts'
      AND column_name = 'delivery_mode'
  LOOP
    RAISE NOTICE '  UNEXPECTED: delivery_mode still present';
  END LOOP;

  RAISE NOTICE '=== package_instances columns ===';
  FOR r IN
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'package_instances'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  %: % nullable=% default=%', r.column_name, r.udt_name, r.is_nullable, r.column_default;
  END LOOP;

  RAISE NOTICE '=== package_membership_status enum values ===';
  FOR r IN
    SELECT e.enumlabel
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'package_membership_status'
    ORDER BY e.enumsortorder
  LOOP
    RAISE NOTICE '  %', r.enumlabel;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
