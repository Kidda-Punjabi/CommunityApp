-- Quick match bot fallback: wait up to 10s for a human, then pair with adaptive computer opponent.

ALTER TABLE public.battle_sessions
  ADD COLUMN IF NOT EXISTS is_quick_match BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_bot_opponent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_skill REAL;

COMMENT ON COLUMN public.battle_sessions.is_quick_match IS
  'True when the session was created via community quick match.';
COMMENT ON COLUMN public.battle_sessions.is_bot_opponent IS
  'True when player two is the adaptive computer opponent (no human profile).';
COMMENT ON COLUMN public.battle_sessions.bot_skill IS
  'Adaptive bot accuracy target between 0 and 1; updated during the match.';

-- Only match other quick-match queue entries (not invite-code lobbies).
CREATE OR REPLACE FUNCTION public.battle_quick_match(p_game_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_session public.battle_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_source NOT IN ('gender_sort', 'conjugation_challenge') THEN
    RAISE EXCEPTION 'Invalid game_source';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE status = 'waiting'
    AND is_quick_match = true
    AND player_two_id IS NULL
    AND is_bot_opponent = false
    AND game_source = p_game_source
    AND player_one_id <> v_user
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.battle_sessions
    SET
      player_two_id = v_user,
      status = 'active',
      started_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;

    RETURN jsonb_build_object(
      'session_id', v_session.id,
      'status', v_session.status,
      'matched', true
    );
  END IF;

  LOOP
    v_code := public._battle_generate_invite_code();
    BEGIN
      INSERT INTO public.battle_sessions (
        player_one_id,
        invite_code,
        game_source,
        is_quick_match
      )
      VALUES (v_user, v_code, p_game_source, true)
      RETURNING * INTO v_session;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'invite_code', v_session.invite_code,
    'matched', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.battle_pair_bot_opponent(
  p_session_id UUID,
  p_bot_skill REAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_skill REAL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_skill := GREATEST(0.25, LEAST(0.9, COALESCE(p_bot_skill, 0.55)));

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF v_session.player_one_id <> v_user THEN
    RAISE EXCEPTION 'Only the waiting player can start a computer match';
  END IF;

  IF NOT v_session.is_quick_match THEN
    RAISE EXCEPTION 'Not a quick match session';
  END IF;

  IF v_session.status <> 'waiting' OR v_session.player_two_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'session_id', v_session.id,
      'status', v_session.status,
      'already_paired', true
    );
  END IF;

  UPDATE public.battle_sessions
  SET
    is_bot_opponent = true,
    bot_skill = v_skill,
    status = 'active',
    started_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'is_bot_opponent', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.battle_mark_round_ready(
  p_session_id UUID,
  p_round_number INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_round public.battle_rounds%ROWTYPE;
  v_is_player_one BOOLEAN;
  v_both_ready BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Battle not active';
  END IF;

  SELECT * INTO v_round
  FROM public.battle_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Round already resolved';
  END IF;

  v_is_player_one := v_session.player_one_id = v_user;

  IF NOT v_is_player_one AND v_session.player_two_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  IF v_is_player_one THEN
    IF v_round.player_one_ready_at IS NULL THEN
      UPDATE public.battle_rounds
      SET player_one_ready_at = now()
      WHERE id = v_round.id
      RETURNING * INTO v_round;
    END IF;

    IF v_session.is_bot_opponent AND v_round.player_two_ready_at IS NULL THEN
      UPDATE public.battle_rounds
      SET player_two_ready_at = now()
      WHERE id = v_round.id
      RETURNING * INTO v_round;
    END IF;
  ELSE
    IF v_round.player_two_ready_at IS NULL THEN
      UPDATE public.battle_rounds
      SET player_two_ready_at = now()
      WHERE id = v_round.id
      RETURNING * INTO v_round;
    END IF;
  END IF;

  v_both_ready :=
    v_round.player_one_ready_at IS NOT NULL
    AND v_round.player_two_ready_at IS NOT NULL;

  IF v_both_ready AND v_round.round_active_at IS NULL THEN
    UPDATE public.battle_rounds
    SET round_active_at = now()
    WHERE id = v_round.id
    RETURNING * INTO v_round;
  END IF;

  RETURN jsonb_build_object(
    'round', row_to_json(v_round)::jsonb,
    'both_ready', v_both_ready
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.battle_record_bot_answer(
  p_session_id UUID,
  p_round_number INTEGER,
  p_answer TEXT,
  p_correct BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_round public.battle_rounds%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Battle not active';
  END IF;

  IF NOT v_session.is_bot_opponent THEN
    RAISE EXCEPTION 'Opponent is not a computer';
  END IF;

  IF v_session.player_one_id <> v_user THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  SELECT * INTO v_round
  FROM public.battle_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Round already resolved';
  END IF;

  IF v_round.round_active_at IS NULL THEN
    RAISE EXCEPTION 'Round not active yet';
  END IF;

  IF v_round.player_two_answered_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'round', row_to_json(v_round)::jsonb,
      'both_answered', (
        v_round.player_one_answered_at IS NOT NULL
        AND v_round.player_two_answered_at IS NOT NULL
      )
    );
  END IF;

  UPDATE public.battle_rounds
  SET
    player_two_answer = p_answer,
    player_two_answered_at = now(),
    player_two_correct = p_correct
  WHERE id = v_round.id
  RETURNING * INTO v_round;

  RETURN jsonb_build_object(
    'round', row_to_json(v_round)::jsonb,
    'both_answered', (
      v_round.player_one_answered_at IS NOT NULL
      AND v_round.player_two_answered_at IS NOT NULL
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.battle_update_bot_skill(
  p_session_id UUID,
  p_bot_skill REAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_skill REAL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_skill := GREATEST(0.25, LEAST(0.9, COALESCE(p_bot_skill, 0.55)));

  UPDATE public.battle_sessions
  SET bot_skill = v_skill
  WHERE id = p_session_id
    AND is_bot_opponent = true
    AND player_one_id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.battle_quick_match(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_pair_bot_opponent(UUID, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_record_bot_answer(UUID, INTEGER, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_update_bot_skill(UUID, REAL) TO authenticated;

NOTIFY pgrst, 'reload schema';
