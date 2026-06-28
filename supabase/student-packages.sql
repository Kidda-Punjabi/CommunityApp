-- Student packages: unified commercial + teaching instance per purchase.
-- Run after tutor-cohort-access.sql and course-access.sql.
-- Optional later: run stripe.sql and the FK block at the bottom to link payments.
--
-- packages = sellable products (what you sell on Stripe)
-- student_packages = one row per student purchase (hub anchor for tutor + calendar + learn)

CREATE TABLE IF NOT EXISTS public.packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  course_id         UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  delivery_mode     public.delivery_mode,
  includes_live_sessions BOOLEAN NOT NULL DEFAULT true,
  display_order     INT NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.packages IS
  'Sellable package products. Maps to a course curriculum + delivery format (1-1, group, or content-only).';

CREATE TABLE IF NOT EXISTS public.student_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  package_id        UUID NOT NULL REFERENCES public.packages (id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (status IN ('pending_setup', 'active', 'paused', 'completed', 'cancelled')),
  purchased_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrollment_id     UUID REFERENCES public.course_enrollments (id) ON DELETE SET NULL,
  stripe_purchase_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, package_id)
);

COMMENT ON TABLE public.student_packages IS
  'A student''s owned package instance — links purchase, tutor enrollment, and calendar visibility.';

CREATE INDEX IF NOT EXISTS idx_student_packages_user
  ON public.student_packages (user_id, status);

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS student_package_id UUID REFERENCES public.student_packages (id) ON DELETE SET NULL;

-- Seed package catalog from existing courses
INSERT INTO public.packages (slug, name, description, course_id, delivery_mode, includes_live_sessions, display_order)
SELECT
  v.slug,
  v.name,
  v.description,
  c.id,
  v.delivery_mode,
  v.includes_live_sessions,
  v.display_order
FROM (
  VALUES
    (
      'foundational',
      'Foundational Course',
      '1-1 live tutoring with pronunciation, core vocabulary, and everyday phrases.',
      'foundational'::text,
      NULL::public.delivery_mode,
      true,
      1
    ),
    (
      'beginners-1-1',
      'Beginners Course (1-1)',
      'Private Beginners lessons with your assigned tutor.',
      'beginners'::text,
      'one_to_one'::public.delivery_mode,
      true,
      2
    ),
    (
      'beginners-group',
      'Beginners Course (Group)',
      'Small-group Punjabi lessons on a fixed weekly schedule.',
      'beginners'::text,
      'group'::public.delivery_mode,
      true,
      3
    ),
    (
      'community',
      'Kidda Community',
      '24 weeks of community content and live sessions.',
      'community'::text,
      NULL::public.delivery_mode,
      false,
      4
    )
) AS v(slug, name, description, tier, delivery_mode, includes_live_sessions, display_order)
JOIN public.courses c ON c.required_tier::text = v.tier
ON CONFLICT (slug) DO NOTHING;

-- Backfill student_packages from existing course_access + enrollments
INSERT INTO public.student_packages (user_id, package_id, course_id, status, purchased_at, enrollment_id)
SELECT
  ca.user_id,
  p.id,
  ca.course_id,
  CASE
    WHEN p.includes_live_sessions = false THEN 'active'
    WHEN ce.id IS NULL THEN 'pending_setup'
    WHEN p.delivery_mode = 'group' AND ce.cohort_id IS NULL THEN 'pending_setup'
    ELSE 'active'
  END,
  ca.granted_at,
  ce.id
FROM public.course_access ca
JOIN public.courses c ON c.id = ca.course_id
LEFT JOIN public.course_enrollments ce
  ON ce.user_id = ca.user_id AND ce.course_id = ca.course_id
JOIN public.packages p ON p.course_id = c.id
  AND (
    (c.required_tier = 'foundational' AND p.slug = 'foundational')
    OR (
      c.required_tier = 'beginners'
      AND p.slug = CASE
        WHEN ce.delivery_mode = 'group' THEN 'beginners-group'
        ELSE 'beginners-1-1'
      END
    )
    OR (c.required_tier = 'community' AND p.slug = 'community')
  )
ON CONFLICT (user_id, package_id) DO NOTHING;

UPDATE public.course_enrollments ce
SET student_package_id = sp.id
FROM public.student_packages sp
WHERE sp.enrollment_id = ce.id
  AND ce.student_package_id IS NULL;

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active packages" ON public.packages;
CREATE POLICY "Anyone reads active packages"
  ON public.packages FOR SELECT TO authenticated
  USING (active = true OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read own packages" ON public.student_packages;
CREATE POLICY "Students read own packages"
  ON public.student_packages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Admins manage packages" ON public.packages;
CREATE POLICY "Admins manage packages"
  ON public.packages FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Admins manage student packages" ON public.student_packages;
CREATE POLICY "Admins manage student packages"
  ON public.student_packages FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

GRANT SELECT ON public.packages TO authenticated;
GRANT SELECT ON public.student_packages TO authenticated;

NOTIFY pgrst, 'reload schema';
