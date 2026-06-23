-- =============================================================================
-- Kidda — Tutor / cohort access + targeted lesson recordings
-- REVIEW ONLY — do not run until approved.
--
-- Depends on: courses (required_tier), lessons, profiles
-- Creates course_access if missing (from course-access.sql)
--
-- Decisions baked in:
--   • course_access = purchase entitlement only (unchanged)
--   • Foundational = always 1-1 via course_enrollments(tutor_id)
--   • Beginners = tutor + delivery_mode (one_to_one | group); group adds cohort
--   • Community = course_access unlocks ALL lessons (Option A); NO cohorts
--   • Cohorts exist ONLY for Beginners group courses
--   • Master admins: adnan@kidda.app, hello@kidda.app (+ assignable app_role)
--   • Tutor / community_lead assignable via profiles.app_role
--   • Purchased but unenrolled Foundational/Beginners: browse only (app layer)
--   • Recordings: 1-1 → student scope; Beginners group → cohort scope
--   • Recording visible only when lesson is also unlocked for viewer
--   • Re-upload replaces row + storage object (app layer deletes old path)
--   • Cohort access until left_at is set on cohort_members
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Prerequisites: course_access (purchase entitlement)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_access (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_access_user_id ON public.course_access (user_id);
CREATE INDEX IF NOT EXISTS idx_course_access_course_id ON public.course_access (course_id);

ALTER TABLE public.course_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own course access" ON public.course_access;
CREATE POLICY "Users can read own course access"
  ON public.course_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.course_access TO authenticated;
GRANT ALL ON public.course_access TO service_role;

-- Backfill from legacy tables when present (no-op if already migrated)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_course_access'
  ) THEN
    INSERT INTO public.course_access (user_id, course_id, granted_at)
    SELECT pca.user_id, c.id, pca.granted_at
    FROM public.profile_course_access pca
    JOIN public.courses c ON c.required_tier = pca.course_tier
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'membership_tier'
  ) THEN
    INSERT INTO public.course_access (user_id, course_id, granted_at)
    SELECT p.id, c.id, now()
    FROM public.profiles p
    JOIN public.courses c ON c.required_tier = p.membership_tier::text
    WHERE p.membership_tier::text IN ('foundational', 'beginners', 'community')
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'member',
      'tutor',
      'community_lead',
      'master_admin'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_mode') THEN
    CREATE TYPE public.delivery_mode AS ENUM ('one_to_one', 'group');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_role public.app_role NOT NULL DEFAULT 'member';

COMMENT ON COLUMN public.profiles.app_role IS
  'member = learner; tutor = assigned students; community_lead = Community ops; master_admin = full access.';

-- Seed master admins (case-insensitive email match)
UPDATE public.profiles p
SET app_role = 'master_admin'
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) IN ('adnan@kidda.app', 'hello@kidda.app');

-- ---------------------------------------------------------------------------
-- Auth helpers (profiles.app_role is source of truth; JWT admin kept for CMS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND COALESCE(raw_app_meta_data ->> 'role', '') = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT app_role FROM public.profiles WHERE id = auth.uid()),
    'member'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() = 'master_admin'::public.app_role
     OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_community_lead()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN (
    'community_lead'::public.app_role,
    'master_admin'::public.app_role
  )
     OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN (
    'tutor'::public.app_role,
    'master_admin'::public.app_role
  )
     OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master_admin()
      OR public.is_community_lead()
      OR public.is_tutor();
$$;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_lead() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tutor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Master admins assign tutor / community_lead roles (avoids conflicting with profile self-update RLS)
CREATE OR REPLACE FUNCTION public.set_user_app_role(
  p_user_id UUID,
  p_role public.app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Only master admins can assign app_role.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required.';
  END IF;

  UPDATE public.profiles
  SET app_role = p_role
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %.', p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_app_role(UUID, public.app_role) TO authenticated;

-- ---------------------------------------------------------------------------
-- Cohorts (Beginners group only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cohorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  tutor_id    UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_course_id ON public.cohorts (course_id);

COMMENT ON TABLE public.cohorts IS
  'Group classes for Beginners delivery_mode = group only. Not used for Community.';

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id   UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  PRIMARY KEY (cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_members_user_active
  ON public.cohort_members (user_id)
  WHERE left_at IS NULL;

-- ---------------------------------------------------------------------------
-- Course enrollments (Foundational + Beginners — NOT Community)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  tutor_id        UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  delivery_mode   public.delivery_mode,
  cohort_id       UUID REFERENCES public.cohorts (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_tutor
  ON public.course_enrollments (tutor_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_cohort
  ON public.course_enrollments (cohort_id)
  WHERE cohort_id IS NOT NULL;

COMMENT ON TABLE public.course_enrollments IS
  'Teaching assignment for Foundational (implicit 1-1) and Beginners. Community uses course_access only.';

COMMENT ON COLUMN public.course_enrollments.delivery_mode IS
  'NULL = Foundational (implicit one_to_one). Required for Beginners.';

-- ---------------------------------------------------------------------------
-- Per-lesson unlocks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.student_lesson_unlocks (
  student_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  unlocked_by  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.cohort_lesson_unlocks (
  cohort_id    UUID NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  unlocked_by  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, lesson_id)
);

-- ---------------------------------------------------------------------------
-- Targeted lesson recordings (1-1 student OR Beginners cohort — not Community)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id        UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  student_id       UUID REFERENCES public.profiles (id) ON DELETE CASCADE,
  cohort_id        UUID REFERENCES public.cohorts (id) ON DELETE CASCADE,
  storage_path     TEXT NOT NULL,
  mime_type        TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  title            TEXT,
  notes            TEXT,
  uploaded_by      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_recordings_scope_xor CHECK (
    (student_id IS NOT NULL AND cohort_id IS NULL)
    OR (student_id IS NULL AND cohort_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS lesson_recordings_student_uq
  ON public.lesson_recordings (lesson_id, student_id)
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_recordings_cohort_uq
  ON public.lesson_recordings (lesson_id, cohort_id)
  WHERE cohort_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_recordings_lesson
  ON public.lesson_recordings (lesson_id);

COMMENT ON TABLE public.lesson_recordings IS
  'Catch-up recordings scoped to one student (1-1) or one cohort (Beginners group). Visible only when lesson is unlocked.';

-- ---------------------------------------------------------------------------
-- Validation triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_cohort_beginners_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT c.required_tier INTO v_tier
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF COALESCE(v_tier, '') <> 'beginners' THEN
    RAISE EXCEPTION 'Cohorts are only allowed for Beginners courses (course_id %).', NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohorts_beginners_only ON public.cohorts;
CREATE TRIGGER trg_cohorts_beginners_only
  BEFORE INSERT OR UPDATE OF course_id ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cohort_beginners_course();

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
    IF NEW.delivery_mode IS NOT NULL THEN
      RAISE EXCEPTION 'Foundational enrollments must not set delivery_mode.';
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

DROP TRIGGER IF EXISTS trg_course_enrollment_rules ON public.course_enrollments;
CREATE TRIGGER trg_course_enrollment_rules
  BEFORE INSERT OR UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_course_enrollment_rules();

CREATE OR REPLACE FUNCTION public.enforce_lesson_recording_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      JOIN public.lessons l ON l.id = NEW.lesson_id
      JOIN public.courses c ON c.id = l.course_id
      WHERE ce.user_id = NEW.student_id
        AND ce.course_id = l.course_id
        AND ce.delivery_mode IS DISTINCT FROM 'group'::public.delivery_mode
    ) THEN
      RAISE EXCEPTION 'student_id must have a 1-1 enrollment for this lesson''s course.';
    END IF;
  END IF;

  IF NEW.cohort_id IS NOT NULL THEN
    SELECT c.required_tier INTO v_tier
    FROM public.cohorts co
    JOIN public.courses c ON c.id = co.course_id
    WHERE co.id = NEW.cohort_id;

    IF COALESCE(v_tier, '') <> 'beginners' THEN
      RAISE EXCEPTION 'cohort_id recordings are only for Beginners group cohorts.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.cohorts co ON co.id = NEW.cohort_id
      WHERE l.id = NEW.lesson_id
        AND l.course_id = co.course_id
    ) THEN
      RAISE EXCEPTION 'lesson_id must belong to the cohort''s course.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_recording_scope ON public.lesson_recordings;
CREATE TRIGGER trg_lesson_recording_scope
  BEFORE INSERT OR UPDATE ON public.lesson_recordings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_recording_scope();

-- ---------------------------------------------------------------------------
-- Access helpers (content unlock + recording visibility)
-- ---------------------------------------------------------------------------

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
  SELECT EXISTS (
    SELECT 1
    FROM public.course_access ca
    WHERE ca.user_id = p_user_id
      AND ca.course_id = p_course_id
  );
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
  v_is_free BOOLEAN;
  v_enrollment public.course_enrollments%ROWTYPE;
BEGIN
  SELECT l.course_id, l.is_free, c.required_tier, c.name
  INTO v_course_id, v_is_free, v_tier, v_course_name
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

  -- Community Option A: course_access unlocks all Community lessons
  IF COALESCE(v_tier, '') = 'community' OR COALESCE(v_course_name, '') ILIKE '%community%' THEN
    RETURN true;
  END IF;

  -- Foundational / Beginners: require enrollment + per-student or cohort unlock
  SELECT * INTO v_enrollment
  FROM public.course_enrollments ce
  WHERE ce.user_id = p_user_id
    AND ce.course_id = v_course_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_enrollment.delivery_mode = 'group'::public.delivery_mode THEN
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

  -- Foundational (delivery_mode NULL) or Beginners one_to_one
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
BEGIN
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

  RETURN EXISTS (
    SELECT 1
    FROM public.cohort_members cm
    WHERE cm.cohort_id = v_rec.cohort_id
      AND cm.user_id = p_user_id
      AND cm.left_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_course_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_content_unlocked(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_lesson_recording(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lesson_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_lesson_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_recordings ENABLE ROW LEVEL SECURITY;

-- Note: profiles RLS is unchanged here (see profile-avatars.sql, weekly-points.sql).
-- Role assignment uses set_user_app_role() RPC as master_admin.

-- Cohorts
DROP POLICY IF EXISTS "Staff read cohorts" ON public.cohorts;
CREATE POLICY "Staff read cohorts"
  ON public.cohorts FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_tutor()
    OR EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = id AND cm.user_id = auth.uid() AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Staff manage cohorts" ON public.cohorts;
CREATE POLICY "Staff manage cohorts"
  ON public.cohorts FOR ALL TO authenticated
  USING (public.is_master_admin() OR public.is_tutor())
  WITH CHECK (public.is_master_admin() OR public.is_tutor());

-- Cohort members
DROP POLICY IF EXISTS "Read cohort membership" ON public.cohort_members;
CREATE POLICY "Read cohort membership"
  ON public.cohort_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_master_admin()
    OR public.is_tutor()
  );

DROP POLICY IF EXISTS "Staff manage cohort members" ON public.cohort_members;
CREATE POLICY "Staff manage cohort members"
  ON public.cohort_members FOR ALL TO authenticated
  USING (public.is_master_admin() OR public.is_tutor())
  WITH CHECK (public.is_master_admin() OR public.is_tutor());

-- Enrollments
DROP POLICY IF EXISTS "Read own enrollment" ON public.course_enrollments;
CREATE POLICY "Read own enrollment"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR tutor_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Staff manage enrollments" ON public.course_enrollments;
CREATE POLICY "Staff manage enrollments"
  ON public.course_enrollments FOR ALL TO authenticated
  USING (public.is_master_admin() OR tutor_id = auth.uid())
  WITH CHECK (public.is_master_admin() OR tutor_id = auth.uid());

-- Student lesson unlocks
DROP POLICY IF EXISTS "Read student unlocks" ON public.student_lesson_unlocks;
CREATE POLICY "Read student unlocks"
  ON public.student_lesson_unlocks FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_master_admin()
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.user_id = student_lesson_unlocks.student_id
        AND ce.tutor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tutor manage student unlocks" ON public.student_lesson_unlocks;
CREATE POLICY "Tutor manage student unlocks"
  ON public.student_lesson_unlocks FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.user_id = student_lesson_unlocks.student_id
        AND ce.tutor_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.user_id = student_lesson_unlocks.student_id
        AND ce.tutor_id = auth.uid()
    )
  );

-- Cohort lesson unlocks
DROP POLICY IF EXISTS "Read cohort unlocks" ON public.cohort_lesson_unlocks;
CREATE POLICY "Read cohort unlocks"
  ON public.cohort_lesson_unlocks FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR public.is_tutor()
    OR EXISTS (
      SELECT 1 FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_lesson_unlocks.cohort_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Staff manage cohort unlocks" ON public.cohort_lesson_unlocks;
CREATE POLICY "Staff manage cohort unlocks"
  ON public.cohort_lesson_unlocks FOR ALL TO authenticated
  USING (public.is_master_admin() OR public.is_tutor())
  WITH CHECK (public.is_master_admin() OR public.is_tutor());

-- Lesson recordings
DROP POLICY IF EXISTS "Read visible lesson recordings" ON public.lesson_recordings;
CREATE POLICY "Read visible lesson recordings"
  ON public.lesson_recordings FOR SELECT TO authenticated
  USING (public.can_view_lesson_recording(auth.uid(), id));

DROP POLICY IF EXISTS "Staff manage lesson recordings" ON public.lesson_recordings;
CREATE POLICY "Staff manage lesson recordings"
  ON public.lesson_recordings FOR ALL TO authenticated
  USING (
    public.is_master_admin()
    OR (
      public.is_tutor()
      AND (
        (student_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.course_enrollments ce
          WHERE ce.user_id = lesson_recordings.student_id
            AND ce.tutor_id = auth.uid()
        ))
        OR (cohort_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.cohorts co
          WHERE co.id = lesson_recordings.cohort_id
            AND (co.tutor_id = auth.uid() OR public.is_master_admin())
        ))
      )
    )
  )
  WITH CHECK (
    public.is_master_admin()
    OR (
      public.is_tutor()
      AND uploaded_by = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohorts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_lesson_unlocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cohort_lesson_unlocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_recordings TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: lesson-recordings (PRIVATE — signed URLs only)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-recordings', 'lesson-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Staff upload lesson recordings" ON storage.objects;
DROP POLICY IF EXISTS "Staff update lesson recordings" ON storage.objects;
DROP POLICY IF EXISTS "Staff delete lesson recordings" ON storage.objects;
DROP POLICY IF EXISTS "Viewer read own lesson recordings" ON storage.objects;

CREATE POLICY "Staff upload lesson recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-recordings'
    AND (public.is_master_admin() OR public.is_tutor())
  );

CREATE POLICY "Staff update lesson recordings"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (public.is_master_admin() OR public.is_tutor())
  );

CREATE POLICY "Staff delete lesson recordings"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (public.is_master_admin() OR public.is_tutor())
  );

CREATE POLICY "Viewer read own lesson recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lesson-recordings'
    AND (
      public.is_master_admin()
      OR public.is_tutor()
      -- App should use signed URLs; path layout:
      -- lessons/{lesson_id}/students/{student_id}/{recording_id}.{ext}
      -- lessons/{lesson_id}/cohorts/{cohort_id}/{recording_id}.{ext}
      OR name LIKE ('lessons/%/students/' || auth.uid()::text || '/%')
      OR EXISTS (
        SELECT 1
        FROM public.cohort_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.left_at IS NULL
          AND name LIKE ('lessons/%/cohorts/' || cm.cohort_id::text || '/%')
      )
    )
  );

NOTIFY pgrst, 'reload schema';
