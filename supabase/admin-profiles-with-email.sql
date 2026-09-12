-- Admin identity lookup: profiles.* plus auth.users.email in one query.
-- Replaces per-request Auth Admin listUsers/getUserById loops on admin dashboards.
-- SECURITY DEFINER so it can read auth.users; EXECUTE granted only to service_role.

CREATE OR REPLACE FUNCTION public.admin_profiles_with_email(p_user_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  auth_created_at timestamptz,
  email_confirmed_at timestamptz,
  full_name text,
  avatar_url text,
  membership_tier public.membership_tier,
  created_at timestamptz,
  updated_at timestamptz,
  preferred_name text,
  referral_code text,
  has_seen_onboarding boolean,
  learner_level integer,
  total_xp integer,
  placement_completed_at timestamptz,
  self_assessed_starting_tier integer,
  stated_goal_motivation text,
  target_tier integer,
  peak_competency_score integer,
  xp_at_level_start integer,
  app_role public.app_role,
  source text,
  sales_call_booked boolean,
  sales_call_booked_at timestamptz,
  phone_call_had boolean,
  phone_call_had_at timestamptz,
  coin_balance integer,
  tutor_bio text,
  has_completed_tutor_setup boolean,
  has_seen_intro_pitch boolean,
  has_agreed_forum_guidelines boolean,
  kids_pin_hash text,
  sound_enabled boolean,
  sound_volume numeric,
  has_completed_community_intro boolean,
  notion_lead_page_id text,
  has_seen_app_tour boolean,
  english_total_xp integer,
  speaking_cefr_level public.cefr_level,
  listening_cefr_level public.cefr_level
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.id, u.id) AS id,
    u.email::text,
    u.created_at AS auth_created_at,
    u.email_confirmed_at,
    p.full_name,
    p.avatar_url,
    p.membership_tier,
    p.created_at,
    p.updated_at,
    p.preferred_name,
    p.referral_code,
    p.has_seen_onboarding,
    p.learner_level,
    p.total_xp,
    p.placement_completed_at,
    p.self_assessed_starting_tier,
    p.stated_goal_motivation,
    p.target_tier,
    p.peak_competency_score,
    p.xp_at_level_start,
    p.app_role,
    p.source,
    p.sales_call_booked,
    p.sales_call_booked_at,
    p.phone_call_had,
    p.phone_call_had_at,
    p.coin_balance,
    p.tutor_bio,
    p.has_completed_tutor_setup,
    p.has_seen_intro_pitch,
    p.has_agreed_forum_guidelines,
    p.kids_pin_hash,
    p.sound_enabled,
    p.sound_volume,
    p.has_completed_community_intro,
    p.notion_lead_page_id,
    p.has_seen_app_tour,
    p.english_total_xp,
    p.speaking_cefr_level,
    p.listening_cefr_level
  FROM auth.users u
  FULL OUTER JOIN public.profiles p ON p.id = u.id
  WHERE p_user_ids IS NULL
     OR COALESCE(p.id, u.id) = ANY (p_user_ids);
END;
$$;

COMMENT ON FUNCTION public.admin_profiles_with_email(uuid[]) IS
  'Service-role admin lookup of profiles plus auth.users.email. Pass NULL for all users, or an id array to filter.';

REVOKE ALL ON FUNCTION public.admin_profiles_with_email(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_profiles_with_email(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_profiles_with_email(uuid[]) TO service_role;

NOTIFY pgrst, 'reload schema';
