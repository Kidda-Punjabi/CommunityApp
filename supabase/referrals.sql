-- =============================================================================
-- Kidda — Referrals (share link + referral status; rewards added later)
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Required by qualify_referral_on_onboarding (full onboarding fields: onboarding-progression.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.referral_code IS
  'Unique invite code for this user; used in /signup?ref=CODE links.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (lower(referral_code))
  WHERE referral_code IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Referral code generation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_result TEXT;
  v_i INTEGER;
BEGIN
  LOOP
    v_result := '';
    FOR v_i IN 1..8 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(referral_code) = lower(v_result)
    );
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_referral_code();

-- Backfill codes for existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL OR btrim(referral_code) = '';

-- -----------------------------------------------------------------------------
-- Referrals table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified')),
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id),
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_signed_up
  ON public.referrals (referrer_user_id, signed_up_at DESC);

COMMENT ON TABLE public.referrals IS
  'Tracks who referred whom. Status becomes qualified when the referred user finishes onboarding.';
COMMENT ON COLUMN public.referrals.status IS
  'pending = signed up; qualified = referred user completed onboarding (rewards TBD).';

-- -----------------------------------------------------------------------------
-- Attribution helpers (trigger + idempotent RPC for app upsert path)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._insert_referral(
  p_referrer UUID,
  p_referred UUID,
  p_code TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_referrer IS NULL OR p_referred IS NULL OR p_referrer = p_referred THEN
    RETURN;
  END IF;

  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code_used,
    status
  )
  VALUES (p_referrer, p_referred, p_code, 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_referral(p_referral_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referrer UUID;
  v_referred UUID;
BEGIN
  v_referred := auth.uid();
  IF v_referred IS NULL THEN
    RETURN;
  END IF;

  v_code := lower(btrim(p_referral_code));
  IF v_code IS NULL OR v_code = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE lower(referral_code) = v_code
  LIMIT 1;

  PERFORM public._insert_referral(v_referrer, v_referred, v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_referrer UUID;
  meta JSONB;
BEGIN
  SELECT raw_user_meta_data INTO meta FROM auth.users WHERE id = NEW.id;
  v_code := lower(btrim(meta->>'referral_code'));

  IF v_code IS NULL OR v_code = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE lower(referral_code) = v_code
  LIMIT 1;

  PERFORM public._insert_referral(v_referrer, NEW.id, v_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_process_referral ON public.profiles;
CREATE TRIGGER trg_profiles_process_referral
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_signup();

-- Mark qualified when referred user completes onboarding
CREATE OR REPLACE FUNCTION public.qualify_referral_on_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.has_seen_onboarding IS TRUE
     AND (OLD.has_seen_onboarding IS DISTINCT FROM TRUE) THEN
    UPDATE public.referrals
    SET
      status = 'qualified',
      qualified_at = COALESCE(qualified_at, now())
    WHERE referred_user_id = NEW.id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_qualify_referral ON public.profiles;
CREATE TRIGGER trg_profiles_qualify_referral
  AFTER UPDATE OF has_seen_onboarding ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.qualify_referral_on_onboarding();

-- -----------------------------------------------------------------------------
-- App-callable: ensure current user has a referral code
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_my_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_code TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT referral_code INTO v_code
  FROM public.profiles
  WHERE id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id)
    VALUES (v_uid)
    ON CONFLICT (id) DO NOTHING;

    SELECT referral_code INTO v_code
    FROM public.profiles
    WHERE id = v_uid;
  END IF;

  IF v_code IS NULL OR btrim(v_code) = '' THEN
    UPDATE public.profiles
    SET referral_code = public.generate_referral_code()
    WHERE id = v_uid
      AND (referral_code IS NULL OR btrim(referral_code) = '')
    RETURNING referral_code INTO v_code;
  END IF;

  RETURN v_code;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrers can read own referrals" ON public.referrals;
CREATE POLICY "Referrers can read own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());

GRANT SELECT ON public.referrals TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_referral(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_referral_code() TO authenticated;

NOTIFY pgrst, 'reload schema';
