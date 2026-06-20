-- =============================================================================
-- One-time backfill: add friendships for existing referral pairs
-- Run after supabase/friends-notifications.sql
-- Idempotent — safe to run more than once
-- =============================================================================

-- Referrer → referred
INSERT INTO public.friendships (user_id, friend_user_id, source, created_at)
SELECT
  r.referrer_user_id,
  r.referred_user_id,
  'referral',
  r.signed_up_at
FROM public.referrals r
WHERE r.referrer_user_id <> r.referred_user_id
ON CONFLICT (user_id, friend_user_id) DO NOTHING;

-- Referred → referrer
INSERT INTO public.friendships (user_id, friend_user_id, source, created_at)
SELECT
  r.referred_user_id,
  r.referrer_user_id,
  'referral',
  r.signed_up_at
FROM public.referrals r
WHERE r.referrer_user_id <> r.referred_user_id
ON CONFLICT (user_id, friend_user_id) DO NOTHING;

-- Clear stale pending requests between referral pairs (no notifications sent)
UPDATE public.friend_requests fr
SET
  status = 'accepted',
  responded_at = COALESCE(fr.responded_at, now())
FROM public.referrals r
WHERE fr.status = 'pending'
  AND (
    (fr.from_user_id = r.referrer_user_id AND fr.to_user_id = r.referred_user_id)
    OR (fr.from_user_id = r.referred_user_id AND fr.to_user_id = r.referrer_user_id)
  );

-- Verification (optional — review output in SQL Editor)
SELECT
  (SELECT COUNT(*) FROM public.referrals) AS referral_rows,
  (SELECT COUNT(*) FROM public.friendships WHERE source = 'referral') AS referral_friendship_rows,
  (
    SELECT COUNT(*)
    FROM public.referrals r
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.user_id = r.referrer_user_id
        AND f.friend_user_id = r.referred_user_id
    )
  ) AS referrals_missing_friendship;
