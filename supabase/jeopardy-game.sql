-- =============================================================================
-- Kidda — Jeopardy group game (game_room_jeopardy_tiles)
-- Run in Supabase SQL Editor after game-rooms.sql
-- Buzz/answer/timeout mirrors buzz-in-game.sql exactly, scoped to tiles.
-- Real-time: Postgres Changes (same as Buzz-in)
-- =============================================================================

ALTER TABLE public.game_rooms
  ADD COLUMN IF NOT EXISTS current_picker_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.game_rooms.current_picker_id IS
  'Jeopardy only: participant who selects the next tile. Unused by other game types.';

CREATE TABLE IF NOT EXISTS public.game_room_jeopardy_tiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  category         TEXT NOT NULL,
  point_value      INTEGER NOT NULL,
  flashcard_id     UUID REFERENCES public.flashcards (id) ON DELETE SET NULL,
  question_payload JSONB,
  status           TEXT NOT NULL DEFAULT 'unopened'
    CHECK (status IN ('unopened', 'active', 'resolved')),
  opened_at        TIMESTAMPTZ,
  buzzed_by        UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  buzzed_at        TIMESTAMPTZ,
  answer_given     TEXT,
  answer_correct   BOOLEAN,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, category, point_value),
  CONSTRAINT game_room_jeopardy_tiles_points_positive CHECK (point_value > 0)
);

CREATE INDEX IF NOT EXISTS idx_game_room_jeopardy_tiles_room
  ON public.game_room_jeopardy_tiles (room_id, category, point_value);
CREATE INDEX IF NOT EXISTS idx_game_room_jeopardy_tiles_active
  ON public.game_room_jeopardy_tiles (room_id)
  WHERE status = 'active';

ALTER TABLE public.game_room_jeopardy_tiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can view jeopardy tiles" ON public.game_room_jeopardy_tiles;
CREATE POLICY "participants can view jeopardy tiles"
  ON public.game_room_jeopardy_tiles FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

GRANT SELECT ON public.game_room_jeopardy_tiles TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._jeopardy_check_game_complete(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_unresolved INTEGER;
BEGIN
  SELECT count(*)::INTEGER INTO v_unresolved
  FROM public.game_room_jeopardy_tiles
  WHERE room_id = p_room_id
    AND status <> 'resolved';

  IF v_unresolved > 0 THEN
    RETURN jsonb_build_object('game_completed', false);
  END IF;

  UPDATE public.game_rooms
  SET status = 'completed', ended_at = now()
  WHERE id = p_room_id AND status = 'in_progress'
  RETURNING * INTO v_room;

  RETURN jsonb_build_object('game_completed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public._jeopardy_resolve_tile(
  p_tile_id UUID,
  p_answer_given TEXT,
  p_answer_correct BOOLEAN,
  p_award_points BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
  v_correct_answer TEXT;
  v_complete JSONB;
BEGIN
  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND OR v_tile.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  v_correct_answer := trim(v_tile.question_payload->>'correct_answer');

  UPDATE public.game_room_jeopardy_tiles
  SET
    answer_given = p_answer_given,
    answer_correct = p_answer_correct,
    resolved_at = now(),
    status = 'resolved'
  WHERE id = p_tile_id
  RETURNING * INTO v_tile;

  IF p_award_points AND p_answer_correct AND v_tile.buzzed_by IS NOT NULL THEN
    UPDATE public.game_room_participants
    SET score = score + v_tile.point_value
    WHERE room_id = v_tile.room_id
      AND user_id = v_tile.buzzed_by
      AND left_at IS NULL;

    UPDATE public.game_rooms
    SET current_picker_id = v_tile.buzzed_by
    WHERE id = v_tile.room_id;
  END IF;

  v_complete := public._jeopardy_check_game_complete(v_tile.room_id);

  RETURN jsonb_build_object(
    'resolved', true,
    'answer_correct', p_answer_correct,
    'correct_answer', v_correct_answer,
    'point_value', v_tile.point_value,
    'complete', v_complete
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: initialize board (called from app after start_game_room)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jeopardy_initialize_board(
  p_room_id UUID,
  p_tiles JSONB,
  p_initial_picker_id UUID,
  p_skipped_tiles JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_tile JSONB;
  v_count INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_tiles IS NULL OR jsonb_typeof(p_tiles) <> 'array' THEN
    RAISE EXCEPTION 'Tiles payload is required';
  END IF;

  IF p_initial_picker_id IS NULL THEN
    RAISE EXCEPTION 'Initial picker is required';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.game_type <> 'jeopardy' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active jeopardy game';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_room_jeopardy_tiles WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object('already_initialized', true, 'room_id', p_room_id);
  END IF;

  IF NOT public._buzz_in_is_playing_participant(p_room_id, p_initial_picker_id) THEN
    RAISE EXCEPTION 'Initial picker must be a playing participant';
  END IF;

  FOR v_tile IN SELECT value FROM jsonb_array_elements(p_tiles)
  LOOP
    INSERT INTO public.game_room_jeopardy_tiles (
      room_id,
      category,
      point_value,
      flashcard_id,
      question_payload,
      status
    )
    VALUES (
      p_room_id,
      v_tile->>'category',
      (v_tile->>'point_value')::INTEGER,
      NULLIF(v_tile->>'flashcard_id', '')::UUID,
      v_tile->'question_payload',
      'unopened'
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.game_rooms
  SET
    current_picker_id = p_initial_picker_id,
    settings = COALESCE(v_room.settings, '{}'::jsonb)
      || jsonb_build_object('skipped_tiles', COALESCE(p_skipped_tiles, '[]'::jsonb))
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'tile_count', v_count,
    'current_picker_id', p_initial_picker_id,
    'skipped_count', jsonb_array_length(COALESCE(p_skipped_tiles, '[]'::jsonb))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: picker selects a tile
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.select_jeopardy_tile(p_tile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_tile.room_id
  FOR UPDATE;

  IF v_room.status <> 'in_progress' OR v_room.game_type <> 'jeopardy' THEN
    RAISE EXCEPTION 'Game is not in progress';
  END IF;

  IF v_room.current_picker_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'It is not your turn to pick';
  END IF;

  IF v_tile.status <> 'unopened' THEN
    RAISE EXCEPTION 'Tile is already opened';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_room_jeopardy_tiles
    WHERE room_id = v_tile.room_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Another tile is already active';
  END IF;

  UPDATE public.game_room_jeopardy_tiles
  SET status = 'active', opened_at = now()
  WHERE id = p_tile_id
  RETURNING * INTO v_tile;

  RETURN jsonb_build_object(
    'tile_id', v_tile.id,
    'status', v_tile.status,
    'opened_at', v_tile.opened_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: atomic buzz claim (mirrors buzz_in)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jeopardy_buzz(p_tile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  IF v_tile.resolved_at IS NOT NULL OR v_tile.status = 'resolved' THEN
    RAISE EXCEPTION 'Tile already resolved';
  END IF;

  IF v_tile.status <> 'active' OR v_tile.opened_at IS NULL THEN
    RAISE EXCEPTION 'Tile is not active';
  END IF;

  IF NOT public._buzz_in_is_playing_participant(v_tile.room_id, v_user) THEN
    RAISE EXCEPTION 'Only playing participants can buzz';
  END IF;

  IF v_tile.buzzed_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'buzzed_by', v_tile.buzzed_by,
      'buzzed_at', v_tile.buzzed_at
    );
  END IF;

  UPDATE public.game_room_jeopardy_tiles
  SET buzzed_by = v_user, buzzed_at = now()
  WHERE id = p_tile_id
    AND buzzed_by IS NULL
    AND resolved_at IS NULL
    AND status = 'active'
  RETURNING * INTO v_tile;

  IF NOT FOUND THEN
    SELECT * INTO v_tile FROM public.game_room_jeopardy_tiles WHERE id = p_tile_id;
    RETURN jsonb_build_object(
      'claimed', false,
      'buzzed_by', v_tile.buzzed_by,
      'buzzed_at', v_tile.buzzed_at
    );
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'buzzed_by', v_tile.buzzed_by,
    'buzzed_at', v_tile.buzzed_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit answer (mirrors submit_buzz_answer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_jeopardy_answer(
  p_tile_id UUID,
  p_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_result JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  IF v_tile.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF v_tile.buzzed_by IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Only the player who buzzed can answer';
  END IF;

  v_correct_answer := trim(v_tile.question_payload->>'correct_answer');
  v_is_correct := trim(COALESCE(p_answer, '')) = v_correct_answer;

  v_result := public._jeopardy_resolve_tile(
    p_tile_id,
    trim(COALESCE(p_answer, '')),
    v_is_correct,
    v_is_correct
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: timeout (mirrors resolve_buzz_in_timeout — client-driven, server validates)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_jeopardy_timeout(p_tile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
  v_buzz_window CONSTANT INTERVAL := interval '12 seconds';
  v_answer_window CONSTANT INTERVAL := interval '7 seconds';
  v_result JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  IF v_tile.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF NOT public._game_room_is_active_participant(v_tile.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF v_tile.status <> 'active' OR v_tile.opened_at IS NULL THEN
    RAISE EXCEPTION 'Tile is not active';
  END IF;

  IF v_tile.buzzed_by IS NULL THEN
    IF now() < v_tile.opened_at + v_buzz_window THEN
      RAISE EXCEPTION 'Buzz window has not elapsed';
    END IF;

    v_result := public._jeopardy_resolve_tile(p_tile_id, NULL, false, false);
  ELSE
    IF now() < v_tile.buzzed_at + v_answer_window THEN
      RAISE EXCEPTION 'Answer window has not elapsed';
    END IF;

    v_result := public._jeopardy_resolve_tile(p_tile_id, COALESCE(v_tile.answer_given, ''), false, false);
  END IF;

  RETURN v_result || jsonb_build_object('timed_out', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.jeopardy_initialize_board(UUID, JSONB, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_jeopardy_tile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.jeopardy_buzz(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_jeopardy_answer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_jeopardy_timeout(UUID) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_jeopardy_tiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_jeopardy_tiles;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Stuck-tile recovery (server sweep + host recover) lives in
-- supabase/jeopardy-stuck-tile-recovery.sql and must be applied after this file.
