-- =============================================================================
-- Kidda — Friend game challenges (head-to-head score battles)
-- Run in Supabase SQL Editor after friends-notifications.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend notification settings + notification types
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS game_challenges BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'friend_level_up',
    'kudos',
    'announcement',
    'friend_game_challenge',
    'friend_game_challenge_result'
  ));

-- ---------------------------------------------------------------------------
-- Friend game challenges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_game_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN (
    'match',
    'memory_grid',
    'speed_translate',
    'streak_survival',
    'sentence_builder',
    'conjugation_challenge',
    'gender_sort'
  )),
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'challenger_playing'
    CHECK (status IN ('challenger_playing', 'awaiting_friend', 'completed', 'cancelled')),
  challenger_score INTEGER,
  challenger_score_metadata JSONB,
  challenged_score INTEGER,
  challenged_score_metadata JSONB,
  winner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  is_tie BOOLEAN NOT NULL DEFAULT false,
  challenger_completed_at TIMESTAMPTZ,
  challenged_completed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (challenger_id <> challenged_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_game_challenges_challenger
  ON public.friend_game_challenges (challenger_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_game_challenges_challenged
  ON public.friend_game_challenges (challenged_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_game_challenges_open
  ON public.friend_game_challenges (status, created_at DESC)
  WHERE status IN ('challenger_playing', 'awaiting_friend');

COMMENT ON TABLE public.friend_game_challenges IS
  'Head-to-head game challenges between friends. Challenger plays first, then challenged friend.';

-- ---------------------------------------------------------------------------
-- Notification helper (respect game_challenges setting)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_user_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_settings public.notification_settings%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public._ensure_notification_settings(p_user_id);
  SELECT * INTO v_settings FROM public.notification_settings WHERE user_id = p_user_id;

  IF p_type = 'friend_request' AND NOT COALESCE(v_settings.friend_requests, true) THEN
    RETURN NULL;
  ELSIF p_type = 'friend_level_up' AND NOT COALESCE(v_settings.friend_level_ups, true) THEN
    RETURN NULL;
  ELSIF p_type = 'kudos' AND NOT COALESCE(v_settings.kudos, true) THEN
    RETURN NULL;
  ELSIF p_type = 'announcement' AND NOT COALESCE(v_settings.announcements, true) THEN
    RETURN NULL;
  ELSIF p_type IN ('friend_game_challenge', 'friend_game_challenge_result')
    AND NOT COALESCE(v_settings.game_challenges, true) THEN
    RETURN NULL;
  END IF;

  IF p_actor_user_id IS NOT NULL AND p_actor_user_id = p_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, actor_user_id, payload)
  VALUES (p_user_id, p_type, p_actor_user_id, COALESCE(p_payload, '{}'::JSONB))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Score comparison
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._compare_challenge_scores(
  p_game_type TEXT,
  p_challenger_score INTEGER,
  p_challenger_meta JSONB,
  p_challenged_score INTEGER,
  p_challenged_meta JSONB,
  p_challenger_id UUID,
  p_challenged_id UUID
)
RETURNS TABLE (winner_id UUID, is_tie BOOLEAN)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_challenger_tiebreak NUMERIC;
  v_challenged_tiebreak NUMERIC;
BEGIN
  IF p_challenger_score > p_challenged_score THEN
    RETURN QUERY SELECT p_challenger_id, false;
    RETURN;
  ELSIF p_challenged_score > p_challenger_score THEN
    RETURN QUERY SELECT p_challenged_id, false;
    RETURN;
  END IF;

  -- Tie on primary score — use game-specific tiebreakers (lower is better for time/moves)
  IF p_game_type = 'match' THEN
    v_challenger_tiebreak := COALESCE((p_challenger_meta->>'time_seconds')::NUMERIC, 999999);
    v_challenged_tiebreak := COALESCE((p_challenged_meta->>'time_seconds')::NUMERIC, 999999);
    IF v_challenger_tiebreak < v_challenged_tiebreak THEN
      RETURN QUERY SELECT p_challenger_id, false;
    ELSIF v_challenged_tiebreak < v_challenger_tiebreak THEN
      RETURN QUERY SELECT p_challenged_id, false;
    ELSE
      RETURN QUERY SELECT NULL::UUID, true;
    END IF;
    RETURN;
  ELSIF p_game_type = 'memory_grid' THEN
    v_challenger_tiebreak := COALESCE((p_challenger_meta->>'moves')::NUMERIC, 999999);
    v_challenged_tiebreak := COALESCE((p_challenged_meta->>'moves')::NUMERIC, 999999);
    IF v_challenger_tiebreak < v_challenged_tiebreak THEN
      RETURN QUERY SELECT p_challenger_id, false;
    ELSIF v_challenged_tiebreak < v_challenger_tiebreak THEN
      RETURN QUERY SELECT p_challenged_id, false;
    ELSE
      RETURN QUERY SELECT NULL::UUID, true;
    END IF;
    RETURN;
  END IF;

  -- Grammar / points games — higher accuracy wins
  v_challenger_tiebreak := COALESCE((p_challenger_meta->>'accuracy')::NUMERIC, 0);
  v_challenged_tiebreak := COALESCE((p_challenged_meta->>'accuracy')::NUMERIC, 0);
  IF v_challenger_tiebreak > v_challenged_tiebreak THEN
    RETURN QUERY SELECT p_challenger_id, false;
  ELSIF v_challenged_tiebreak > v_challenger_tiebreak THEN
    RETURN QUERY SELECT p_challenged_id, false;
  ELSE
    RETURN QUERY SELECT NULL::UUID, true;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_friend_game_challenge(
  p_challenged_id UUID,
  p_game_type TEXT,
  p_config JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_challenged_id IS NULL OR p_challenged_id = v_user THEN
    RAISE EXCEPTION 'Invalid friend';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = v_user AND friend_user_id = p_challenged_id
  ) THEN
    RAISE EXCEPTION 'You can only challenge friends';
  END IF;

  IF p_game_type IS NULL OR btrim(p_game_type) = '' THEN
    RAISE EXCEPTION 'Game type required';
  END IF;

  INSERT INTO public.friend_game_challenges (
    challenger_id,
    challenged_id,
    game_type,
    config,
    status
  )
  VALUES (
    v_user,
    p_challenged_id,
    p_game_type,
    COALESCE(p_config, '{}'::JSONB),
    'challenger_playing'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_friend_game_challenge_score(
  p_challenge_id UUID,
  p_score INTEGER,
  p_score_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.friend_game_challenges%ROWTYPE;
  v_winner UUID;
  v_is_tie BOOLEAN;
  v_game_title TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_score IS NULL OR p_score < 0 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  SELECT * INTO v_row
  FROM public.friend_game_challenges
  WHERE id = p_challenge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  IF v_row.status = 'completed' OR v_row.status = 'cancelled' THEN
    RAISE EXCEPTION 'Challenge already finished';
  END IF;

  v_game_title := replace(v_row.game_type, '_', ' ');

  IF v_user = v_row.challenger_id AND v_row.status = 'challenger_playing' THEN
    UPDATE public.friend_game_challenges
    SET
      challenger_score = p_score,
      challenger_score_metadata = COALESCE(p_score_metadata, '{}'::JSONB),
      challenger_completed_at = now(),
      status = 'awaiting_friend'
    WHERE id = p_challenge_id;

    PERFORM public._create_notification(
      v_row.challenged_id,
      'friend_game_challenge',
      v_user,
      jsonb_build_object(
        'challenge_id', p_challenge_id,
        'game_type', v_row.game_type,
        'challenger_score', p_score
      )
    );

    RETURN jsonb_build_object(
      'status', 'awaiting_friend',
      'role', 'challenger',
      'your_score', p_score
    );
  END IF;

  IF v_user = v_row.challenged_id AND v_row.status = 'awaiting_friend' THEN
    SELECT cmp.winner_id, cmp.is_tie
    INTO v_winner, v_is_tie
    FROM public._compare_challenge_scores(
      v_row.game_type,
      v_row.challenger_score,
      COALESCE(v_row.challenger_score_metadata, '{}'::JSONB),
      p_score,
      COALESCE(p_score_metadata, '{}'::JSONB),
      v_row.challenger_id,
      v_row.challenged_id
    ) AS cmp;

    UPDATE public.friend_game_challenges
    SET
      challenged_score = p_score,
      challenged_score_metadata = COALESCE(p_score_metadata, '{}'::JSONB),
      challenged_completed_at = now(),
      winner_id = v_winner,
      is_tie = COALESCE(v_is_tie, false),
      status = 'completed',
      completed_at = now()
    WHERE id = p_challenge_id;

    PERFORM public._create_notification(
      v_row.challenger_id,
      'friend_game_challenge_result',
      v_user,
      jsonb_build_object(
        'challenge_id', p_challenge_id,
        'game_type', v_row.game_type,
        'winner_id', v_winner,
        'is_tie', COALESCE(v_is_tie, false),
        'challenger_score', v_row.challenger_score,
        'challenged_score', p_score
      )
    );

    RETURN jsonb_build_object(
      'status', 'completed',
      'role', 'challenged',
      'your_score', p_score,
      'winner_id', v_winner,
      'is_tie', COALESCE(v_is_tie, false),
      'challenger_score', v_row.challenger_score
    );
  END IF;

  RAISE EXCEPTION 'Not your turn for this challenge';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_game_challenge(p_challenge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.friend_game_challenges%ROWTYPE;
  v_challenger RECORD;
  v_challenged RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row
  FROM public.friend_game_challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_user <> v_row.challenger_id AND v_user <> v_row.challenged_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id, full_name, preferred_name, avatar_url
  INTO v_challenger
  FROM public.profiles WHERE id = v_row.challenger_id;

  SELECT id, full_name, preferred_name, avatar_url
  INTO v_challenged
  FROM public.profiles WHERE id = v_row.challenged_id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'game_type', v_row.game_type,
    'config', v_row.config,
    'status', v_row.status,
    'challenger_id', v_row.challenger_id,
    'challenged_id', v_row.challenged_id,
    'challenger_score', v_row.challenger_score,
    'challenged_score', v_row.challenged_score,
    'challenger_score_metadata', v_row.challenger_score_metadata,
    'challenged_score_metadata', v_row.challenged_score_metadata,
    'winner_id', v_row.winner_id,
    'is_tie', v_row.is_tie,
    'created_at', v_row.created_at,
    'completed_at', v_row.completed_at,
    'your_role', CASE
      WHEN v_user = v_row.challenger_id THEN 'challenger'
      ELSE 'challenged'
    END,
    'challenger', jsonb_build_object(
      'id', v_challenger.id,
      'full_name', v_challenger.full_name,
      'preferred_name', v_challenger.preferred_name,
      'avatar_url', v_challenger.avatar_url
    ),
    'challenged', jsonb_build_object(
      'id', v_challenged.id,
      'full_name', v_challenged.full_name,
      'preferred_name', v_challenged.preferred_name,
      'avatar_url', v_challenged.avatar_url
    )
  );
END;
$$;

-- Update notification settings RPC
CREATE OR REPLACE FUNCTION public.update_notification_settings(
  p_friend_requests BOOLEAN,
  p_friend_level_ups BOOLEAN,
  p_kudos BOOLEAN,
  p_announcements BOOLEAN,
  p_game_challenges BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notification_settings (
    user_id, friend_requests, friend_level_ups, kudos, announcements, game_challenges, updated_at
  )
  VALUES (
    v_user,
    COALESCE(p_friend_requests, true),
    COALESCE(p_friend_level_ups, true),
    COALESCE(p_kudos, true),
    COALESCE(p_announcements, true),
    COALESCE(p_game_challenges, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    friend_requests = COALESCE(p_friend_requests, notification_settings.friend_requests),
    friend_level_ups = COALESCE(p_friend_level_ups, notification_settings.friend_level_ups),
    kudos = COALESCE(p_kudos, notification_settings.kudos),
    announcements = COALESCE(p_announcements, notification_settings.announcements),
    game_challenges = COALESCE(p_game_challenges, notification_settings.game_challenges),
    updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.friend_game_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read own challenges" ON public.friend_game_challenges;
CREATE POLICY "Participants read own challenges"
  ON public.friend_game_challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

GRANT SELECT ON public.friend_game_challenges TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_friend_game_challenge(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_friend_game_challenge_score(UUID, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_game_challenge(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
