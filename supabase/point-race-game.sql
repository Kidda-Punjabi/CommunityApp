-- =============================================================================
-- Kidda — Point Race (point_race) — Quizlet Live Individuals-style
-- Run after game-rooms.sql
-- Each player has independent question stream; first to 20 ends the room.
-- Winner tie-break: UPDATE game_rooms … WHERE status = 'in_progress' (only one wins).
-- Question payloads: generated in app (buildMcqPayload), stored via RPC.
-- =============================================================================

ALTER TABLE public.game_rooms DROP CONSTRAINT IF EXISTS game_rooms_game_type_check;
ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_game_type_check
  CHECK (game_type IN (
    'buzz_in',
    'jeopardy',
    'chado_pauri_group',
    'sentence_builder_group',
    'point_race'
  ));

CREATE TABLE IF NOT EXISTS public.game_room_race_state (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                 UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  player_id               UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  current_question_payload JSONB NOT NULL,
  score                   INTEGER NOT NULL DEFAULT 0,
  questions_answered      INTEGER NOT NULL DEFAULT 0,
  is_winner               BOOLEAN NOT NULL DEFAULT false,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, player_id),
  CONSTRAINT game_room_race_state_score_non_negative CHECK (score >= 0),
  CONSTRAINT game_room_race_state_questions_non_negative CHECK (questions_answered >= 0)
);

CREATE INDEX IF NOT EXISTS idx_game_room_race_state_room
  ON public.game_room_race_state (room_id);
CREATE INDEX IF NOT EXISTS idx_game_room_race_state_room_score
  ON public.game_room_race_state (room_id, score DESC);

ALTER TABLE public.game_room_race_state ENABLE ROW LEVEL SECURITY;

-- Own row only — hides other players' current_question_payload from direct SELECT / Realtime.
DROP POLICY IF EXISTS "players can view own race state" ON public.game_room_race_state;
CREATE POLICY "players can view own race state"
  ON public.game_room_race_state FOR SELECT TO authenticated
  USING (
    player_id = auth.uid()
    AND public._game_room_is_active_participant(room_id, auth.uid())
  );

GRANT SELECT ON public.game_room_race_state TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._point_race_win_score()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 20;
$$;

CREATE OR REPLACE FUNCTION public._point_race_validate_mcq_payload(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_payload IS NOT NULL
    AND jsonb_typeof(p_payload->'options') = 'array'
    AND jsonb_array_length(p_payload->'options') = 4
    AND coalesce(trim(p_payload->>'flashcard_id'), '') <> ''
    AND coalesce(trim(p_payload->>'prompt'), '') <> ''
    AND coalesce(trim(p_payload->>'correct_answer'), '') <> '';
$$;

-- ---------------------------------------------------------------------------
-- RPC: standings for live leaderboard (no question payloads)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_race_standings(p_room_id UUID)
RETURNS TABLE (
  player_id UUID,
  score INTEGER,
  questions_answered INTEGER,
  is_winner BOOLEAN,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  RETURN QUERY
  SELECT
    rs.player_id,
    rs.score,
    rs.questions_answered,
    rs.is_winner,
    rs.updated_at
  FROM public.game_room_race_state rs
  WHERE rs.room_id = p_room_id
  ORDER BY rs.score DESC, rs.questions_answered ASC, rs.updated_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: initialize per-player race rows (called from app after start_game_room)
-- ---------------------------------------------------------------------------

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
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND OR v_room.game_type <> 'point_race' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active point race game';
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

    IF v_player IS NULL OR NOT public._point_race_validate_mcq_payload(v_payload) THEN
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

  UPDATE public.game_rooms
  SET settings = COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object('win_score', public._point_race_win_score())
  WHERE id = p_room_id;

  RETURN jsonb_build_object('room_id', p_room_id, 'players_initialized', v_inserted);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit answer (atomic per-player; app supplies next question payload)
-- Double-submit guard: UPDATE only when flashcard_id still matches answered question.
-- Winner race: FOR UPDATE game_rooms + UPDATE … WHERE status = 'in_progress'.
-- ---------------------------------------------------------------------------

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
  v_answered_flashcard_id TEXT;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_new_score INTEGER;
  v_win_score INTEGER := public._point_race_win_score();
  v_winner_claimed BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._point_race_validate_mcq_payload(p_next_question) THEN
    RAISE EXCEPTION 'Invalid next question payload';
  END IF;

  SELECT rs.* INTO v_state
  FROM public.game_room_race_state rs
  INNER JOIN public.game_rooms gr ON gr.id = rs.room_id
  WHERE rs.player_id = v_user
    AND gr.game_type = 'point_race'
    AND gr.status = 'in_progress'
  ORDER BY rs.updated_at DESC
  LIMIT 1
  FOR UPDATE OF rs;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active point race found for this player';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = v_state.room_id;

  IF v_room.status <> 'in_progress' THEN
    RETURN jsonb_build_object('game_ended', true);
  END IF;

  v_answered_flashcard_id := v_state.current_question_payload->>'flashcard_id';
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
    AND (current_question_payload->>'flashcard_id') IS NOT DISTINCT FROM v_answered_flashcard_id
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

-- Extend create_game_room to allow point_race
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
    'buzz_in', 'jeopardy', 'chado_pauri_group', 'sentence_builder_group', 'point_race'
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

GRANT EXECUTE ON FUNCTION public.list_race_standings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.race_initialize_game(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_race_answer(TEXT, JSONB) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_race_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_race_state;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
