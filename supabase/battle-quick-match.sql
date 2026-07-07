-- Quick match: join an open waiting battle or create one.
-- Superseded by battle-bot-quick-match.sql (adds is_quick_match flag and bot fallback).
-- Run battle-bot-quick-match.sql for the full quick match + computer opponent feature.

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
    AND COALESCE(is_quick_match, false) = true
    AND player_two_id IS NULL
    AND COALESCE(is_bot_opponent, false) = false
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
      INSERT INTO public.battle_sessions (player_one_id, invite_code, game_source, is_quick_match)
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

GRANT EXECUTE ON FUNCTION public.battle_quick_match(TEXT) TO authenticated;
