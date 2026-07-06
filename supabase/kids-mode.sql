-- =============================================================================
-- Kidda — Kids Mode (kid profiles, PIN, stickers, session context)
-- Run in Supabase SQL Editor
-- =============================================================================

-- Parent PIN (hashed 4-digit, set during Kids Mode setup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kids_pin_hash TEXT;

COMMENT ON COLUMN public.profiles.kids_pin_hash IS
  'Scrypt hash of parent 4-digit PIN for exiting Kids Mode. NULL until first kid profile setup.';

-- ---------------------------------------------------------------------------
-- kid_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kid_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  avatar_icon TEXT NOT NULL,
  age_tier TEXT NOT NULL CHECK (age_tier IN ('pre_reader', 'early_reader', 'independent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kid_profiles_parent_user_id
  ON public.kid_profiles (parent_user_id);

-- ---------------------------------------------------------------------------
-- Session context (for RLS — mirrors active kid profile in app cookie)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kid_session_context (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  active_kid_profile_id UUID REFERENCES public.kid_profiles (id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kid_session_context IS
  'Tracks active kid profile per parent auth user. Used by forum RLS to block kid sessions.';

-- ---------------------------------------------------------------------------
-- kid_activity_log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kid_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_profile_id UUID NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_kid_activity_log_profile
  ON public.kid_activity_log (kid_profile_id, completed_at DESC);

-- ---------------------------------------------------------------------------
-- kid_stickers (earned stickers per kid profile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kid_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_profile_id UUID NOT NULL REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  sticker_icon TEXT NOT NULL,
  sticker_name TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kid_profile_id, sticker_icon)
);

CREATE INDEX IF NOT EXISTS idx_kid_stickers_profile
  ON public.kid_stickers (kid_profile_id, earned_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.kid_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kid_profiles_updated_at ON public.kid_profiles;
CREATE TRIGGER trg_kid_profiles_updated_at
  BEFORE UPDATE ON public.kid_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.kid_profiles_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_active_kid_profile()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kid_session_context ksc
    JOIN public.kid_profiles kp ON kp.id = ksc.active_kid_profile_id
    WHERE ksc.user_id = auth.uid()
      AND ksc.active_kid_profile_id IS NOT NULL
      AND kp.parent_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_active_kid_profile() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: kid_profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.kid_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents manage own kid profiles" ON public.kid_profiles;
CREATE POLICY "Parents manage own kid profiles"
  ON public.kid_profiles FOR ALL TO authenticated
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: kid_session_context
-- ---------------------------------------------------------------------------

ALTER TABLE public.kid_session_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents manage own kid session" ON public.kid_session_context;
CREATE POLICY "Parents manage own kid session"
  ON public.kid_session_context FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: kid_activity_log
-- ---------------------------------------------------------------------------

ALTER TABLE public.kid_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents read kid activity" ON public.kid_activity_log;
CREATE POLICY "Parents read kid activity"
  ON public.kid_activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents insert kid activity" ON public.kid_activity_log;
CREATE POLICY "Parents insert kid activity"
  ON public.kid_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: kid_stickers
-- ---------------------------------------------------------------------------

ALTER TABLE public.kid_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents read kid stickers" ON public.kid_stickers;
CREATE POLICY "Parents read kid stickers"
  ON public.kid_stickers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents insert kid stickers" ON public.kid_stickers;
CREATE POLICY "Parents insert kid stickers"
  ON public.kid_stickers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kid_profiles kp
      WHERE kp.id = kid_profile_id AND kp.parent_user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_session_context TO authenticated;
GRANT SELECT, INSERT ON public.kid_activity_log TO authenticated;
GRANT SELECT, INSERT ON public.kid_stickers TO authenticated;

GRANT ALL ON public.kid_profiles TO service_role;
GRANT ALL ON public.kid_session_context TO service_role;
GRANT ALL ON public.kid_activity_log TO service_role;
GRANT ALL ON public.kid_stickers TO service_role;

NOTIFY pgrst, 'reload schema';
