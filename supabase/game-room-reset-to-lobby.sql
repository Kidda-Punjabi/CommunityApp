-- =============================================================================
-- Persistent group game rooms: reset completed/in-progress rooms back to lobby
-- so the same join code can host another game / topic, plus late join before
-- per-game init has locked the roster in.
-- Apply via: SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-game-room-reset-to-lobby.ts
-- =============================================================================

CREATE OR REPLACE FUNCTION public._game_room_wipe_game_state(p_room_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Buzz-in rounds
  DELETE FROM public.game_room_rounds WHERE room_id = p_room_id;

  -- Jeopardy tiles
  DELETE FROM public.game_room_jeopardy_tiles WHERE room_id = p_room_id;

  -- Point Race
  DELETE FROM public.game_room_race_state WHERE room_id = p_room_id;

  -- Chado Pauri group ladder (votes cascade to questions/votes when FK set)
  DELETE FROM public.game_room_ladder_votes
  WHERE question_id IN (
    SELECT q.id
    FROM public.game_room_ladder_questions q
    JOIN public.game_room_ladder_runs r ON r.id = q.run_id
    WHERE r.room_id = p_room_id
  );
  DELETE FROM public.game_room_ladder_questions
  WHERE run_id IN (
    SELECT id FROM public.game_room_ladder_runs WHERE room_id = p_room_id
  );
  DELETE FROM public.game_room_ladder_runs WHERE room_id = p_room_id;

  -- Collaborative sentence builder
  DELETE FROM public.game_room_sentence_placements
  WHERE round_id IN (
    SELECT id FROM public.game_room_sentence_rounds WHERE room_id = p_room_id
  );
  DELETE FROM public.game_room_sentence_rounds WHERE room_id = p_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._game_room_is_initialized(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.game_room_rounds WHERE room_id = p_room_id LIMIT 1) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_room_jeopardy_tiles WHERE room_id = p_room_id LIMIT 1) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_room_race_state WHERE room_id = p_room_id LIMIT 1) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_room_ladder_runs WHERE room_id = p_room_id LIMIT 1) THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_room_sentence_rounds WHERE room_id = p_room_id LIMIT 1) THEN
    RETURN true;
  END IF;
  RETURN false;
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
    'buzz_in', 'jeopardy', 'chado_pauri_group', 'sentence_builder_group', 'point_race'
  ) THEN
    RAISE EXCEPTION 'Invalid game type';
  END IF;

  -- Keep host-chosen content filters when provided; otherwise start clean for the type.
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

-- Allow join while lobby, or late join / rejoin before game state is initialized.
CREATE OR REPLACE FUNCTION public.join_game_room(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_code TEXT := upper(trim(p_join_code));
  v_existing public.game_room_participants%ROWTYPE;
  v_initialized BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_code = '' THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE join_code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status = 'cancelled' OR v_room.status = 'completed' THEN
    RAISE EXCEPTION 'This room is no longer accepting players';
  END IF;

  v_initialized := public._game_room_is_initialized(v_room.id);

  IF v_room.status = 'in_progress' AND v_initialized THEN
    RAISE EXCEPTION 'This game has already started';
  END IF;

  IF v_room.status <> 'lobby' AND NOT (v_room.status = 'in_progress' AND NOT v_initialized) THEN
    RAISE EXCEPTION 'This game has already started';
  END IF;

  SELECT * INTO v_existing
  FROM public.game_room_participants
  WHERE room_id = v_room.id AND user_id = v_user;

  IF FOUND THEN
    UPDATE public.game_room_participants
    SET left_at = NULL, joined_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.game_room_participants (room_id, user_id, is_host, is_playing)
    VALUES (
      v_room.id,
      v_user,
      v_user = v_room.host_id,
      v_user <> v_room.host_id
    );
  END IF;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'game_type', v_room.game_type
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_game_room_to_lobby(UUID, TEXT, JSONB) TO authenticated;
