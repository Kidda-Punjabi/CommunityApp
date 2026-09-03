-- Sound Match / Vowel Match group races reuse game_room_race_state + Point Race RPCs.
-- Win condition stays first-to-N (settings.win_score). Point Race still defaults to 20.

ALTER TABLE public.game_rooms DROP CONSTRAINT IF EXISTS game_rooms_game_type_check;
ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_game_type_check
  CHECK (game_type IN (
    'buzz_in',
    'jeopardy',
    'chado_pauri_group',
    'sentence_builder_group',
    'point_race',
    'sound_match_group',
    'vowel_match_group'
  ));

CREATE OR REPLACE FUNCTION public._is_race_game_type(p_game_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_game_type IN ('point_race', 'sound_match_group', 'vowel_match_group');
$$;

CREATE OR REPLACE FUNCTION public._race_question_id(p_payload JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    nullif(trim(p_payload->>'question_id'), ''),
    nullif(trim(p_payload->>'flashcard_id'), '')
  );
$$;

CREATE OR REPLACE FUNCTION public._race_validate_payload(p_game_type TEXT, p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_game_type = 'point_race' THEN public._point_race_validate_mcq_payload(p_payload)
    WHEN p_game_type = 'sound_match_group' THEN
      p_payload IS NOT NULL
      AND jsonb_typeof(p_payload->'options') = 'array'
      AND jsonb_array_length(p_payload->'options') BETWEEN 2 AND 4
      AND coalesce(trim(p_payload->>'audio_url'), '') <> ''
      AND coalesce(trim(p_payload->>'correct_answer'), '') <> ''
      AND public._race_question_id(p_payload) IS NOT NULL
    WHEN p_game_type = 'vowel_match_group' THEN
      p_payload IS NOT NULL
      AND jsonb_typeof(p_payload->'options') = 'array'
      AND jsonb_array_length(p_payload->'options') BETWEEN 2 AND 10
      AND coalesce(trim(p_payload->>'audio_url'), '') <> ''
      AND coalesce(trim(p_payload->>'correct_answer'), '') <> ''
      AND public._race_question_id(p_payload) IS NOT NULL
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.race_initialize_game(
  p_room_id UUID,
  p_states JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_state JSONB;
  v_player UUID;
  v_payload JSONB;
  v_inserted INTEGER := 0;
  v_win_score INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND OR NOT public._is_race_game_type(v_room.game_type) OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active race game';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_room_race_state WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object('already_initialized', true);
  END IF;

  IF p_states IS NULL OR jsonb_typeof(p_states) <> 'array' OR jsonb_array_length(p_states) = 0 THEN
    RAISE EXCEPTION 'No race states provided';
  END IF;

  FOR v_state IN SELECT value FROM jsonb_array_elements(p_states) AS value
  LOOP
    v_player := (v_state->>'player_id')::UUID;
    v_payload := v_state->'current_question_payload';

    IF v_player IS NULL OR NOT public._race_validate_payload(v_room.game_type, v_payload) THEN
      RAISE EXCEPTION 'Invalid race state entry';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.game_room_participants grp
      WHERE grp.room_id = p_room_id
        AND grp.user_id = v_player
        AND grp.left_at IS NULL
        AND grp.is_playing = true
    ) THEN
      RAISE EXCEPTION 'Player % is not an active playing participant', v_player;
    END IF;

    INSERT INTO public.game_room_race_state (
      room_id,
      player_id,
      current_question_payload
    )
    VALUES (p_room_id, v_player, v_payload);

    v_inserted := v_inserted + 1;
  END LOOP;

  v_win_score := COALESCE(
    NULLIF((v_room.settings->>'win_score')::INTEGER, 0),
    public._point_race_win_score()
  );
  IF v_win_score < 1 THEN
    v_win_score := public._point_race_win_score();
  END IF;
  IF v_win_score > 50 THEN
    v_win_score := 50;
  END IF;

  UPDATE public.game_rooms
  SET settings = COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object('win_score', v_win_score)
  WHERE id = p_room_id;

  RETURN jsonb_build_object('room_id', p_room_id, 'players_initialized', v_inserted);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_race_answer(
  p_answer TEXT,
  p_next_question JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_state public.game_room_race_state%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
  v_answered_id TEXT;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_new_score INTEGER;
  v_win_score INTEGER;
  v_winner_claimed BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT rs.* INTO v_state
  FROM public.game_room_race_state rs
  INNER JOIN public.game_rooms gr ON gr.id = rs.room_id
  WHERE rs.player_id = v_user
    AND public._is_race_game_type(gr.game_type)
    AND gr.status = 'in_progress'
  ORDER BY rs.updated_at DESC
  LIMIT 1
  FOR UPDATE OF rs;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active race found for this player';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = v_state.room_id;

  IF v_room.status <> 'in_progress' THEN
    RETURN jsonb_build_object('game_ended', true);
  END IF;

  IF NOT public._race_validate_payload(v_room.game_type, p_next_question) THEN
    RAISE EXCEPTION 'Invalid next question payload';
  END IF;

  v_answered_id := public._race_question_id(v_state.current_question_payload);
  v_correct_answer := trim(v_state.current_question_payload->>'correct_answer');
  v_is_correct := trim(coalesce(p_answer, '')) = v_correct_answer;

  UPDATE public.game_room_race_state
  SET
    questions_answered = questions_answered + 1,
    score = score + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    current_question_payload = p_next_question,
    updated_at = now()
  WHERE id = v_state.id
    AND player_id = v_user
    AND public._race_question_id(current_question_payload) IS NOT DISTINCT FROM v_answered_id
  RETURNING * INTO v_state;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('already_answered', true);
  END IF;

  v_new_score := v_state.score;

  IF v_is_correct THEN
    UPDATE public.game_room_participants
    SET score = score + 1
    WHERE room_id = v_state.room_id
      AND user_id = v_user
      AND left_at IS NULL;
  END IF;

  v_win_score := COALESCE(
    NULLIF((v_room.settings->>'win_score')::INTEGER, 0),
    public._point_race_win_score()
  );

  IF v_new_score >= v_win_score THEN
    SELECT * INTO v_room
    FROM public.game_rooms
    WHERE id = v_state.room_id
    FOR UPDATE;

    IF v_room.status = 'in_progress' THEN
      UPDATE public.game_rooms
      SET
        status = 'completed',
        ended_at = now(),
        settings = COALESCE(v_room.settings, '{}'::jsonb)
          || jsonb_build_object('winner_id', v_user)
      WHERE id = v_state.room_id
        AND status = 'in_progress';

      IF FOUND THEN
        v_winner_claimed := true;

        UPDATE public.game_room_race_state
        SET is_winner = true
        WHERE id = v_state.id;

        UPDATE public.game_room_participants grp
        SET score = rs.score
        FROM public.game_room_race_state rs
        WHERE rs.room_id = v_state.room_id
          AND rs.player_id = grp.user_id
          AND grp.room_id = v_state.room_id
          AND grp.left_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'was_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'new_score', v_new_score,
    'current_question_payload', v_state.current_question_payload,
    'game_completed', v_winner_claimed,
    'is_winner', v_winner_claimed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_game_room(
  p_game_type TEXT,
  p_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_room public.game_rooms%ROWTYPE;
  v_settings JSONB := COALESCE(p_settings, '{}'::jsonb);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_type NOT IN (
    'buzz_in', 'jeopardy', 'chado_pauri_group', 'sentence_builder_group', 'point_race',
    'sound_match_group', 'vowel_match_group'
  ) THEN
    RAISE EXCEPTION 'Invalid game type';
  END IF;

  IF NOT (v_settings ? 'question_count') THEN
    v_settings := v_settings || jsonb_build_object('question_count', 10);
  END IF;

  LOOP
    v_code := public._game_room_generate_join_code();
    BEGIN
      INSERT INTO public.game_rooms (host_id, game_type, join_code, settings)
      VALUES (v_user, p_game_type, v_code, v_settings)
      RETURNING * INTO v_room;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  INSERT INTO public.game_room_participants (room_id, user_id, is_host, is_playing)
  VALUES (v_room.id, v_user, true, false);

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'join_code', v_room.join_code,
    'game_type', v_room.game_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_game_room_to_lobby(
  p_room_id UUID,
  p_game_type TEXT DEFAULT NULL,
  p_settings JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_next_type TEXT;
  v_next_settings JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.host_id <> v_user THEN
    RAISE EXCEPTION 'Only the host can reset the room';
  END IF;

  IF v_room.status NOT IN ('completed', 'in_progress') THEN
    RAISE EXCEPTION 'Room cannot be reset from this status';
  END IF;

  v_next_type := COALESCE(NULLIF(trim(p_game_type), ''), v_room.game_type);
  IF v_next_type NOT IN (
    'buzz_in', 'jeopardy', 'chado_pauri_group', 'sentence_builder_group', 'point_race',
    'sound_match_group', 'vowel_match_group'
  ) THEN
    RAISE EXCEPTION 'Invalid game type';
  END IF;

  IF p_settings IS NULL THEN
    v_next_settings := COALESCE(v_room.settings, '{}'::jsonb)
      - 'winner_id'
      - 'ladder_turn_order'
      - 'ladder_ask_room_uses'
      - 'ladder_half_half_used'
      - 'ladder_ask_tutor_used';
  ELSE
    v_next_settings := COALESCE(p_settings, '{}'::jsonb);
  END IF;

  PERFORM public._game_room_wipe_game_state(p_room_id);

  UPDATE public.game_room_participants
  SET score = 0
  WHERE room_id = p_room_id AND left_at IS NULL;

  UPDATE public.game_rooms
  SET
    status = 'lobby',
    game_type = v_next_type,
    settings = v_next_settings,
    current_picker_id = NULL,
    started_at = NULL,
    ended_at = NULL
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'join_code', v_room.join_code,
    'game_type', v_next_type,
    'status', 'lobby'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._is_race_game_type(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.race_initialize_game(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_race_answer(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_room(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_game_room_to_lobby(UUID, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
