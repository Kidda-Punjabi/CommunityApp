-- =============================================================================
-- Kidda — Stripe membership + course tier access
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Tier values: free | foundational | beginners | community
-- (membership_tier column should already exist on profiles)

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS required_tier TEXT NOT NULL DEFAULT 'foundational';

-- Map existing courses by name (edit names if yours differ)
UPDATE public.courses
SET required_tier = 'foundational'
WHERE required_tier = 'foundational'
  AND name ILIKE '%foundational%';

UPDATE public.courses
SET required_tier = 'beginners'
WHERE name ILIKE '%beginner%';

UPDATE public.courses
SET required_tier = 'community'
WHERE name ILIKE '%community%';

CREATE TABLE IF NOT EXISTS public.stripe_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stripe_event_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_purchases_user_id
  ON public.stripe_purchases (user_id);

ALTER TABLE public.stripe_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own stripe purchases" ON public.stripe_purchases;
CREATE POLICY "Users can read own stripe purchases"
  ON public.stripe_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.stripe_purchases TO authenticated;
GRANT ALL ON public.stripe_purchases TO service_role;

-- Per-course unlocks (each purchase grants one course only)
CREATE TABLE IF NOT EXISTS public.profile_course_access (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  course_tier TEXT NOT NULL CHECK (course_tier IN ('foundational', 'beginners', 'community')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_tier)
);

CREATE INDEX IF NOT EXISTS idx_profile_course_access_user_id
  ON public.profile_course_access (user_id);

ALTER TABLE public.profile_course_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own course access" ON public.profile_course_access;
CREATE POLICY "Users can read own course access"
  ON public.profile_course_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.profile_course_access TO authenticated;
GRANT ALL ON public.profile_course_access TO service_role;

-- Migrate any existing single-tier profiles into per-course access
INSERT INTO public.profile_course_access (user_id, course_tier)
SELECT id, membership_tier
FROM public.profiles
WHERE membership_tier IN ('foundational', 'beginners', 'community')
ON CONFLICT (user_id, course_tier) DO NOTHING;

NOTIFY pgrst, 'reload schema';
