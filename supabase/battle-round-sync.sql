-- Battle round sync: both players must acknowledge ready before timer starts.
-- Run in Supabase SQL Editor after battle-mode.sql.

ALTER TABLE public.battle_rounds
  ADD COLUMN IF NOT EXISTS player_one_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS player_two_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS round_active_at TIMESTAMPTZ;

COMMENT ON COLUMN public.battle_rounds.round_active_at IS
  'Set when both players have acknowledged the round; answer timer starts here.';

-- Recreate start_round: round_started_at = created, timer waits for both ready.
CREATE OR REPLACE FUNCTION public.battle_start_round(
  p_session_id UUID,
  p_round_number INTEGER,
  p_question_payload JSONB,
  p_round_multiplier NUMERIC
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

  IF NOT public._battle_is_player(p_session_id, v_user) THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Battle is not active';
  END IF;

  IF v_session.current_round <> p_round_number THEN
    RAISE EXCEPTION 'Round number mismatch';
  END IF;

  INSERT INTO public.battle_rounds (
    session_id,
    round_number,
    question_payload,
    round_multiplier,
    round_started_at
  )
  VALUES (
    p_session_id,
    p_round_number,
    p_question_payload,
    p_round_multiplier,
    now()
  )
  ON CONFLICT (session_id, round_number) DO NOTHING
  RETURNING * INTO v_round;

  IF v_round.id IS NULL THEN
    SELECT * INTO v_round
    FROM public.battle_rounds
    WHERE session_id = p_session_id AND round_number = p_round_number;
  END IF;

  RETURN jsonb_build_object(
    'round_id', v_round.id,
    'round_number', v_round.round_number,
    'round_started_at', v_round.round_started_at,
    'round_active_at', v_round.round_active_at,
    'player_one_ready_at', v_round.player_one_ready_at,
    'player_two_ready_at', v_round.player_two_ready_at,
    'question_payload', v_round.question_payload
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

-- Answers only accepted after round is active for both players.
CREATE OR REPLACE FUNCTION public.battle_record_answer(
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
  v_is_player_one BOOLEAN;
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

  IF v_round.round_active_at IS NULL THEN
    RAISE EXCEPTION 'Round not active yet';
  END IF;

  v_is_player_one := v_session.player_one_id = v_user;

  IF NOT v_is_player_one AND v_session.player_two_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  IF v_is_player_one THEN
    IF v_round.player_one_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already answered';
    END IF;
    UPDATE public.battle_rounds
    SET
      player_one_answer = p_answer,
      player_one_answered_at = now(),
      player_one_correct = p_correct
    WHERE id = v_round.id
    RETURNING * INTO v_round;
  ELSE
    IF v_round.player_two_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already answered';
    END IF;
    UPDATE public.battle_rounds
    SET
      player_two_answer = p_answer,
      player_two_answered_at = now(),
      player_two_correct = p_correct
    WHERE id = v_round.id
    RETURNING * INTO v_round;
  END IF;

  RETURN jsonb_build_object(
    'round', row_to_json(v_round)::jsonb,
    'both_answered', (
      v_round.player_one_answered_at IS NOT NULL
      AND v_round.player_two_answered_at IS NOT NULL
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.battle_mark_round_ready(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
