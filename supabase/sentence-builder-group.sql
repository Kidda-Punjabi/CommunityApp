-- =============================================================================
-- Kidda — Collaborative Sentence Building (sentence_builder_group)
-- Run after game-rooms.sql
-- Turn enforcement: single authorized caller (Jeopardy picker pattern, not atomic race)
-- Tile logic: correct_position + is_distractor (ported from conversation hard mode /
--   grammar_sentences.word_tiles consumption)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.game_room_sentence_rounds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                 UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  round_number            INTEGER NOT NULL,
  grammar_sentence_id     UUID NOT NULL REFERENCES public.grammar_sentences (id) ON DELETE CASCADE,
  tile_pool               JSONB NOT NULL,
  filled_slots            JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_turn_player_id  UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.game_room_sentence_placements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES public.game_room_sentence_rounds (id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tile_identifier TEXT NOT NULL,
  was_correct     BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_room_sentence_rounds_room
  ON public.game_room_sentence_rounds (room_id, round_number);
CREATE INDEX IF NOT EXISTS idx_game_room_sentence_placements_round
  ON public.game_room_sentence_placements (round_id);

ALTER TABLE public.game_room_sentence_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_sentence_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can view sentence rounds" ON public.game_room_sentence_rounds;
CREATE POLICY "participants can view sentence rounds"
  ON public.game_room_sentence_rounds FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

DROP POLICY IF EXISTS "participants can view sentence placements" ON public.game_room_sentence_placements;
CREATE POLICY "participants can view sentence placements"
  ON public.game_room_sentence_placements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_room_sentence_rounds r
      WHERE r.id = game_room_sentence_placements.round_id
        AND public._game_room_is_active_participant(r.room_id, auth.uid())
    )
  );

GRANT SELECT ON public.game_room_sentence_rounds TO authenticated;
GRANT SELECT ON public.game_room_sentence_placements TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._sentence_playing_participants_ordered(p_room_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(user_id ORDER BY joined_at ASC), ARRAY[]::UUID[])
  FROM public.game_room_participants
  WHERE room_id = p_room_id
    AND left_at IS NULL
    AND is_playing = true;
$$;

CREATE OR REPLACE FUNCTION public._sentence_next_turn_player(
  p_room_id UUID,
  p_current_player_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_players UUID[];
  v_count INTEGER;
  v_idx INTEGER;
BEGIN
  v_players := public._sentence_playing_participants_ordered(p_room_id);
  v_count := coalesce(array_length(v_players, 1), 0);

  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  v_idx := array_position(v_players, p_current_player_id);
  IF v_idx IS NULL THEN
    RETURN v_players[1];
  END IF;

  IF v_idx >= v_count THEN
    RETURN v_players[1];
  END IF;

  RETURN v_players[v_idx + 1];
END;
$$;

CREATE OR REPLACE FUNCTION public._sentence_next_expected_position(
  p_tile_pool JSONB,
  p_filled_count INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_positions INTEGER[];
BEGIN
  SELECT array_agg((elem->>'correct_position')::INTEGER ORDER BY (elem->>'correct_position')::INTEGER)
  INTO v_positions
  FROM jsonb_array_elements(p_tile_pool) AS elem
  WHERE coalesce((elem->>'is_distractor')::BOOLEAN, false) = false;

  IF v_positions IS NULL OR p_filled_count >= array_length(v_positions, 1) THEN
    RETURN NULL;
  END IF;

  RETURN v_positions[p_filled_count + 1];
END;
$$;

CREATE OR REPLACE FUNCTION public._sentence_is_complete(
  p_tile_pool JSONB,
  p_filled_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_correct_count INTEGER;
BEGIN
  SELECT count(*)::INTEGER INTO v_correct_count
  FROM jsonb_array_elements(p_tile_pool) AS elem
  WHERE coalesce((elem->>'is_distractor')::BOOLEAN, false) = false;

  RETURN p_filled_count >= v_correct_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: initialize session (first round + store sentence ids in settings)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sentence_initialize_game(
  p_room_id UUID,
  p_grammar_sentence_id UUID,
  p_tile_pool JSONB,
  p_session_sentence_ids JSONB,
  p_total_rounds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_first_player UUID;
  v_round_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND OR v_room.game_type <> 'sentence_builder_group' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active sentence builder game';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_room_sentence_rounds WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object('already_initialized', true);
  END IF;

  v_first_player := (public._sentence_playing_participants_ordered(p_room_id))[1];
  IF v_first_player IS NULL THEN
    RAISE EXCEPTION 'No playing participants';
  END IF;

  UPDATE public.game_rooms
  SET settings = COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object(
      'question_count', p_total_rounds,
      'session_sentence_ids', p_session_sentence_ids
    )
  WHERE id = p_room_id;

  INSERT INTO public.game_room_sentence_rounds (
    room_id,
    round_number,
    grammar_sentence_id,
    tile_pool,
    current_turn_player_id
  )
  VALUES (p_room_id, 1, p_grammar_sentence_id, p_tile_pool, v_first_player)
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'round_id', v_round_id,
    'current_turn_player_id', v_first_player
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start a subsequent round (turn continues from prior round)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sentence_create_round(
  p_room_id UUID,
  p_round_number INTEGER,
  p_grammar_sentence_id UUID,
  p_tile_pool JSONB,
  p_current_turn_player_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  INSERT INTO public.game_room_sentence_rounds (
    room_id,
    round_number,
    grammar_sentence_id,
    tile_pool,
    current_turn_player_id
  )
  VALUES (p_room_id, p_round_number, p_grammar_sentence_id, p_tile_pool, p_current_turn_player_id)
  ON CONFLICT (room_id, round_number) DO NOTHING
  RETURNING id INTO v_round_id;

  IF v_round_id IS NULL THEN
    SELECT id INTO v_round_id
    FROM public.game_room_sentence_rounds
    WHERE room_id = p_room_id AND round_number = p_round_number;
  END IF;

  RETURN jsonb_build_object('round_id', v_round_id, 'round_number', p_round_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: place a tile (turn-verified, not atomic race)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_tile_placement(
  p_round_id UUID,
  p_tile_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round public.game_room_sentence_rounds%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
  v_tile JSONB;
  v_filled_count INTEGER;
  v_expected_position INTEGER;
  v_is_correct BOOLEAN := false;
  v_next_player UUID;
  v_total_rounds INTEGER;
  v_session_ids JSONB;
  v_next_sentence_id UUID;
  v_points CONSTANT INTEGER := 1;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM public.game_room_sentence_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND OR v_round.status <> 'active' THEN
    RAISE EXCEPTION 'Round is not active';
  END IF;

  IF v_round.current_turn_player_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'It is not your turn';
  END IF;

  SELECT elem INTO v_tile
  FROM jsonb_array_elements(v_round.tile_pool) AS elem
  WHERE elem->>'tile_identifier' = p_tile_identifier;

  IF v_tile IS NULL THEN
    RAISE EXCEPTION 'Tile not found in pool';
  END IF;

  v_filled_count := coalesce(jsonb_array_length(v_round.filled_slots), 0);
  v_expected_position := public._sentence_next_expected_position(v_round.tile_pool, v_filled_count);

  v_is_correct := v_expected_position IS NOT NULL
    AND coalesce((v_tile->>'is_distractor')::BOOLEAN, false) = false
    AND (v_tile->>'correct_position')::INTEGER = v_expected_position;

  INSERT INTO public.game_room_sentence_placements (
    round_id, player_id, tile_identifier, was_correct
  )
  VALUES (p_round_id, v_user, p_tile_identifier, v_is_correct);

  IF v_is_correct THEN
    UPDATE public.game_room_sentence_rounds
    SET filled_slots = v_round.filled_slots || jsonb_build_array(
      jsonb_build_object(
        'tile_identifier', v_tile->>'tile_identifier',
        'gurmukhi', v_tile->>'gurmukhi',
        'romanised', coalesce(v_tile->>'romanised', ''),
        'correct_position', (v_tile->>'correct_position')::INTEGER
      )
    )
    WHERE id = p_round_id
    RETURNING * INTO v_round;

    UPDATE public.game_room_participants
    SET score = score + v_points
    WHERE room_id = v_round.room_id
      AND user_id = v_user
      AND left_at IS NULL;
  END IF;

  v_next_player := public._sentence_next_turn_player(v_round.room_id, v_user);

  UPDATE public.game_room_sentence_rounds
  SET current_turn_player_id = v_next_player
  WHERE id = p_round_id
  RETURNING * INTO v_round;

  IF public._sentence_is_complete(v_round.tile_pool, coalesce(jsonb_array_length(v_round.filled_slots), 0)) THEN
    UPDATE public.game_room_sentence_rounds
    SET status = 'completed', completed_at = now()
    WHERE id = p_round_id
    RETURNING * INTO v_round;

    SELECT * INTO v_room FROM public.game_rooms WHERE id = v_round.room_id FOR UPDATE;

    v_total_rounds := coalesce((v_room.settings->>'question_count')::INTEGER, 1);
    v_session_ids := coalesce(v_room.settings->'session_sentence_ids', '[]'::jsonb);

    IF v_round.round_number >= v_total_rounds THEN
      UPDATE public.game_rooms
      SET status = 'completed', ended_at = now()
      WHERE id = v_round.room_id;

      RETURN jsonb_build_object(
        'was_correct', v_is_correct,
        'round_completed', true,
        'game_completed', true,
        'next_turn_player_id', v_next_player
      );
    END IF;

    v_next_sentence_id := (v_session_ids->>(v_round.round_number))::UUID;

    RETURN jsonb_build_object(
      'was_correct', v_is_correct,
      'round_completed', true,
      'game_completed', false,
      'next_round_number', v_round.round_number + 1,
      'next_grammar_sentence_id', v_next_sentence_id,
      'next_turn_player_id', v_next_player
    );
  END IF;

  RETURN jsonb_build_object(
    'was_correct', v_is_correct,
    'round_completed', false,
    'next_turn_player_id', v_next_player
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sentence_initialize_game(UUID, UUID, JSONB, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sentence_create_round(UUID, INTEGER, UUID, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tile_placement(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_sentence_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_sentence_rounds;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_sentence_placements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_sentence_placements;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
