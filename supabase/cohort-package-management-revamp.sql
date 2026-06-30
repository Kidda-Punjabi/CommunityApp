-- =============================================================================
-- Kidda — Cohort & package management schema revamp
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
--
-- Touches: profiles, cohorts, student_packages
-- Adds: package_instances, onboarding_checklists (+ enums package_instance_status,
--        package_membership_status, onboarding_checklist_type)
--
-- If you already ran an earlier version of this file (cohorts.delivery_mode present,
-- no package_instances table), run package-instances-and-schema-fixes.sql instead.
--
-- Does NOT touch: packages, courses, course_enrollments, games, calendar tables.
--
-- Pre-migration code audit (student_packages.status old values):
--   src/lib/admin/load-cohorts-overview.ts — reads status, .neq('cancelled')
--   src/app/admin/content/components/cohorts-tab.tsx — checks pending_setup
--   src/lib/packages/load-student-packages.ts — derives status in app layer (OK)
--   src/components/packages/package-hub-panel.tsx — uses app-layer status (OK)
-- UI follow-up required after this migration runs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Part 1: profiles — lead-tracking fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS sales_call_booked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_call_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_call_had boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_call_had_at timestamptz;

COMMENT ON COLUMN public.profiles.source IS
  'Free-text: where this lead/member came from (e.g. Instagram, Referral, Google).';
COMMENT ON COLUMN public.profiles.sales_call_booked IS
  'True once the member has booked a sales call (in-app or otherwise).';
COMMENT ON COLUMN public.profiles.phone_call_had IS
  'True once a phone call has actually taken place with this lead/member.';

-- Existing RLS: "Users can update own profile" allows full-row self-service UPDATE.
-- Protect admin/tutor-set lead fields via trigger (column-level RLS is not used here).

CREATE OR REPLACE FUNCTION public.protect_profile_lead_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_community_lead() THEN
    IF NEW.sales_call_booked IS DISTINCT FROM OLD.sales_call_booked THEN
      IF NEW.sales_call_booked AND NEW.sales_call_booked_at IS NULL THEN
        NEW.sales_call_booked_at := now();
      ELSIF NOT NEW.sales_call_booked THEN
        NEW.sales_call_booked_at := NULL;
      END IF;
    END IF;

    IF NEW.phone_call_had IS DISTINCT FROM OLD.phone_call_had THEN
      IF NEW.phone_call_had AND NEW.phone_call_had_at IS NULL THEN
        NEW.phone_call_had_at := now();
      ELSIF NOT NEW.phone_call_had THEN
        NEW.phone_call_had_at := NULL;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  NEW.source := OLD.source;
  NEW.sales_call_booked := OLD.sales_call_booked;
  NEW.sales_call_booked_at := OLD.sales_call_booked_at;
  NEW.phone_call_had := OLD.phone_call_had;
  NEW.phone_call_had_at := OLD.phone_call_had_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_lead_fields_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_community_lead() THEN
    RETURN NEW;
  END IF;

  NEW.source := NULL;
  NEW.sales_call_booked := false;
  NEW.sales_call_booked_at := NULL;
  NEW.phone_call_had := false;
  NEW.phone_call_had_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_lead_fields ON public.profiles;
CREATE TRIGGER trg_profiles_protect_lead_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_lead_fields();

DROP TRIGGER IF EXISTS trg_profiles_protect_lead_fields_insert ON public.profiles;
CREATE TRIGGER trg_profiles_protect_lead_fields_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_lead_fields_insert();

-- ---------------------------------------------------------------------------
-- Part 2a: package_instance_status enum
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'package_instance_status'
  ) THEN
    CREATE TYPE public.package_instance_status AS ENUM (
      'pre_scheduling',
      'recruiting',
      'scheduled',
      'in_progress',
      'paused',
      'postponed',
      'incomplete',
      'classes_completed',
      'offboarding_complete'
    );
  END IF;
END $$;

COMMENT ON TYPE public.package_instance_status IS
  'Shared lifecycle status for cohorts (group) and package_instances (1-1/small-group). UI groups: To-do (pre_scheduling, recruiting, scheduled), In progress (in_progress, paused), Complete (postponed, incomplete, classes_completed, offboarding_complete). Manually set — no automatic transitions.';

-- ---------------------------------------------------------------------------
-- Part 2b: extend cohorts (group runs only — NOT the same as package_instances)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS status public.package_instance_status NOT NULL DEFAULT 'pre_scheduling',
  ADD COLUMN IF NOT EXISTS start_day_of_week text
    CHECK (
      start_day_of_week IS NULL
      OR start_day_of_week = ANY (
        ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
      )
    ),
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 7 CHECK (capacity > 0);

COMMENT ON TABLE public.cohorts IS
  'Group cohorts for group-format packages (e.g. Beginners group). Not used for 1-1 — those use package_instances. Not used for Community.';
COMMENT ON COLUMN public.cohorts.capacity IS
  'Max students in this group cohort. Default 7; editable per cohort.';
COMMENT ON COLUMN public.cohorts.status IS
  'Lifecycle status for this group cohort (package_instance_status enum).';

-- ---------------------------------------------------------------------------
-- Part 2c: package_instances (1-1 and small-group — NOT cohorts)
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
  'Scheduled runs for non-cohort packages (1-1 and small-group). Group-format packages use cohorts instead.';

CREATE INDEX IF NOT EXISTS idx_package_instances_package_id ON public.package_instances (package_id);
CREATE INDEX IF NOT EXISTS idx_package_instances_tutor_id ON public.package_instances (tutor_id) WHERE tutor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_package_instance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_instances_updated_at ON public.package_instances;
CREATE TRIGGER trg_package_instances_updated_at
  BEFORE UPDATE ON public.package_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_package_instance_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_package_instance_not_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delivery_mode public.delivery_mode;
BEGIN
  SELECT p.delivery_mode INTO v_delivery_mode FROM public.packages p WHERE p.id = NEW.package_id;
  IF v_delivery_mode = 'group'::public.delivery_mode THEN
    RAISE EXCEPTION 'Group-format packages use cohorts, not package_instances.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_instances_not_group ON public.package_instances;
CREATE TRIGGER trg_package_instances_not_group
  BEFORE INSERT OR UPDATE OF package_id ON public.package_instances
  FOR EACH ROW EXECUTE FUNCTION public.enforce_package_instance_not_group();

ALTER TABLE public.package_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read package instances" ON public.package_instances;
CREATE POLICY "Staff read package instances"
  ON public.package_instances FOR SELECT TO authenticated
  USING (public.is_community_lead() OR tutor_id = auth.uid() OR public.is_tutor());

DROP POLICY IF EXISTS "Staff manage package instances" ON public.package_instances;
CREATE POLICY "Staff manage package instances"
  ON public.package_instances FOR ALL TO authenticated
  USING (public.is_community_lead() OR tutor_id = auth.uid())
  WITH CHECK (public.is_community_lead() OR tutor_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_instances TO authenticated;

-- ---------------------------------------------------------------------------
-- Part 3: package_membership_status + student_packages.status restructure
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'package_membership_status'
  ) THEN
    CREATE TYPE public.package_membership_status AS ENUM (
      'interested',
      'waiting_for_payment',
      'confirmed',
      'withdrawn'
    );
  END IF;
END $$;

COMMENT ON TYPE public.package_membership_status IS
  'A person''s relationship to a purchased package (student_packages). withdrawn = cancelled/removed. Instance lifecycle (paused, completed) lives on cohorts.status or package_instances.status.';

DO $$
DECLARE
  v_cancelled_count integer;
BEGIN
  SELECT count(*) INTO v_cancelled_count
  FROM public.student_packages
  WHERE status = 'cancelled';

  IF v_cancelled_count > 0 THEN
    RAISE NOTICE 'Mapping % cancelled student_packages row(s) → withdrawn.', v_cancelled_count;
  END IF;
END $$;

ALTER TABLE public.student_packages
  ADD COLUMN IF NOT EXISTS new_status public.package_membership_status;

UPDATE public.student_packages
SET new_status = 'interested'::public.package_membership_status
WHERE status = 'pending_setup'
  AND new_status IS NULL;

UPDATE public.student_packages
SET new_status = 'confirmed'::public.package_membership_status
WHERE status IN ('active', 'paused', 'completed')
  AND new_status IS NULL;

UPDATE public.student_packages
SET new_status = 'withdrawn'::public.package_membership_status
WHERE status = 'cancelled'
  AND new_status IS NULL;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id FROM public.student_packages WHERE status = 'cancelled'
  LOOP
    RAISE NOTICE 'Mapped cancelled → withdrawn: student_packages.id=% user_id=%', r.id, r.user_id;
  END LOOP;
END $$;

DO $$
DECLARE
  v_null_count integer;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.student_packages WHERE new_status IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'Migration blocked: % student_packages row(s) still have NULL new_status.', v_null_count;
  END IF;
END $$;

ALTER TABLE public.student_packages
  ADD COLUMN IF NOT EXISTS package_instance_id uuid
    REFERENCES public.package_instances (id) ON DELETE SET NULL;

-- Finalize student_packages status column (re-run this block alone after resolving cancelled rows)
ALTER TABLE public.student_packages DROP COLUMN IF EXISTS status;
ALTER TABLE public.student_packages RENAME COLUMN new_status TO status;
ALTER TABLE public.student_packages
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'interested'::public.package_membership_status;

-- ---------------------------------------------------------------------------
-- Part 4: onboarding_checklists
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'onboarding_checklist_type'
  ) THEN
    CREATE TYPE public.onboarding_checklist_type AS ENUM ('group', 'one_to_one');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_package_id uuid NOT NULL REFERENCES public.student_packages (id) ON DELETE CASCADE,
  checklist_type public.onboarding_checklist_type NOT NULL,

  time_assigned boolean NOT NULL DEFAULT false,
  welcome_email boolean NOT NULL DEFAULT false,
  calendar_invite boolean NOT NULL DEFAULT false,
  tutor_notified boolean NOT NULL DEFAULT false,
  package_created boolean NOT NULL DEFAULT false,
  whatsapp_chat_made boolean NOT NULL DEFAULT false,
  schedule_whatsapp_chat boolean NOT NULL DEFAULT false,
  onboarding_completed boolean NOT NULL DEFAULT false,
  payment_date date,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_package_id)
);

COMMENT ON TABLE public.onboarding_checklists IS
  'One onboarding checklist per student_packages row (1:1). Overdue is computed in the UI from payment_date, not stored. Group and 1-1 share the same column set; checklist_type just determines which fields the UI shows as relevant.';
COMMENT ON COLUMN public.onboarding_checklists.payment_date IS
  'Used by the UI to compute an "overdue" indicator (payment_date in the past AND onboarding_completed = false). Not stored as a separate column.';

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_student_package_id
  ON public.onboarding_checklists (student_package_id);

CREATE OR REPLACE FUNCTION public.touch_onboarding_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_checklists_updated_at ON public.onboarding_checklists;
CREATE TRIGGER trg_onboarding_checklists_updated_at
  BEFORE UPDATE ON public.onboarding_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_onboarding_checklist_updated_at();

ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tutor_can_access_student_package(p_student_package_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_packages sp
    LEFT JOIN public.course_enrollments ce_id ON ce_id.id = sp.enrollment_id
    LEFT JOIN public.course_enrollments ce_course
      ON ce_course.user_id = sp.user_id AND ce_course.course_id = sp.course_id
    WHERE sp.id = p_student_package_id
      AND (ce_id.tutor_id = auth.uid() OR ce_course.tutor_id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_access_student_package(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins and community leads can manage onboarding checklists"
  ON public.onboarding_checklists;
DROP POLICY IF EXISTS "Staff manage onboarding checklists" ON public.onboarding_checklists;
CREATE POLICY "Staff manage onboarding checklists"
  ON public.onboarding_checklists FOR ALL TO authenticated
  USING (
    public.is_community_lead()
    OR (public.is_tutor() AND public.tutor_can_access_student_package(student_package_id))
  )
  WITH CHECK (
    public.is_community_lead()
    OR (public.is_tutor() AND public.tutor_can_access_student_package(student_package_id))
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_checklists TO authenticated;

-- ---------------------------------------------------------------------------
-- Post-migration verification (schema summary to NOTICES)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== profiles (new lead columns) ===';
  FOR r IN
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN (
        'source',
        'sales_call_booked',
        'sales_call_booked_at',
        'phone_call_had',
        'phone_call_had_at'
      )
    ORDER BY column_name
  LOOP
    RAISE NOTICE '  %: % nullable=% default=%', r.column_name, r.data_type, r.is_nullable, r.column_default;
  END LOOP;

  RAISE NOTICE '=== cohorts (extended columns) ===';
  FOR r IN
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cohorts'
      AND column_name IN ('status', 'start_day_of_week', 'start_date', 'end_date', 'capacity')
    ORDER BY column_name
  LOOP
    RAISE NOTICE '  %: % nullable=% default=%', r.column_name, r.udt_name, r.is_nullable, r.column_default;
  END LOOP;

  RAISE NOTICE '=== student_packages.status ===';
  FOR r IN
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_packages'
      AND column_name = 'status'
  LOOP
    RAISE NOTICE '  %: % nullable=% default=%', r.column_name, r.udt_name, r.is_nullable, r.column_default;
  END LOOP;

  RAISE NOTICE '=== onboarding_checklists columns ===';
  FOR r IN
    SELECT column_name, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'onboarding_checklists'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  %: % nullable=%', r.column_name, r.udt_name, r.is_nullable;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
