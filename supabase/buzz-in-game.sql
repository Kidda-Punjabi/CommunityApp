-- =============================================================================
-- Kidda — Buzz-in group game (game_room_rounds + server-authoritative RPCs)
-- Run in Supabase SQL Editor after game-rooms.sql
-- Real-time: Postgres Changes (same as game_rooms / battle_rounds — not Broadcast)
-- Buzz fairness: atomic UPDATE ... WHERE buzzed_by IS NULL (same spirit as battle timestamps)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.game_room_rounds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  round_number     INTEGER NOT NULL,
  question_payload JSONB NOT NULL,
  opened_at        TIMESTAMPTZ,
  buzzed_by        UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  buzzed_at        TIMESTAMPTZ,
  answer_given     TEXT,
  answer_correct   BOOLEAN,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, round_number),
  CONSTRAINT game_room_rounds_round_positive CHECK (round_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_game_room_rounds_room
  ON public.game_room_rounds (room_id, round_number);
CREATE INDEX IF NOT EXISTS idx_game_room_rounds_active
  ON public.game_room_rounds (room_id)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE public.game_room_rounds IS
  'Per-round question snapshot for group games. Buzz-in uses atomic buzzed_by claim + server timestamps.';
COMMENT ON COLUMN public.game_room_rounds.opened_at IS
  'When the round became active. NULL until the round is opened (round 1 at init; later rounds on advance).';

-- ---------------------------------------------------------------------------
-- RLS (membership-gated via SECURITY DEFINER helper — no self-recursion)
-- ---------------------------------------------------------------------------

ALTER TABLE public.game_room_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can view room rounds" ON public.game_room_rounds;
CREATE POLICY "participants can view room rounds"
  ON public.game_room_rounds FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

GRANT SELECT ON public.game_room_rounds TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._buzz_in_is_playing_participant(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.game_room_participants grp
    WHERE grp.room_id = p_room_id
      AND grp.user_id = p_user_id
      AND grp.left_at IS NULL
      AND grp.is_playing = true
  );
$$;

CREATE OR REPLACE FUNCTION public._buzz_in_advance_room(
  p_room_id UUID,
  p_completed_round_number INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_total INTEGER;
  v_next INTEGER;
BEGIN
  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.game_type <> 'buzz_in' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active buzz-in game';
  END IF;

  SELECT count(*)::INTEGER INTO v_total
  FROM public.game_room_rounds
  WHERE room_id = p_room_id;

  v_next := p_completed_round_number + 1;

  IF v_next > v_total THEN
    UPDATE public.game_rooms
    SET
      status = 'completed',
      ended_at = now(),
      settings = COALESCE(v_room.settings, '{}'::jsonb)
        || jsonb_build_object('current_round', p_completed_round_number)
    WHERE id = p_room_id
    RETURNING * INTO v_room;

    RETURN jsonb_build_object(
      'game_completed', true,
      'current_round', p_completed_round_number
    );
  END IF;

  UPDATE public.game_rooms
  SET settings = COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object('current_round', v_next)
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  UPDATE public.game_room_rounds
  SET opened_at = now()
  WHERE room_id = p_room_id AND round_number = v_next;

  RETURN jsonb_build_object(
    'game_completed', false,
    'current_round', v_next
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: insert pre-built rounds (called from app after start_game_room)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.buzz_in_initialize_rounds(
  p_room_id UUID,
  p_rounds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_round JSONB;
  v_round_number INTEGER;
  v_count INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_rounds IS NULL OR jsonb_typeof(p_rounds) <> 'array' OR jsonb_array_length(p_rounds) = 0 THEN
    RAISE EXCEPTION 'Rounds payload is required';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.game_type <> 'buzz_in' THEN
    RAISE EXCEPTION 'Not a buzz-in room';
  END IF;

  IF v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not in progress';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_room_rounds WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object('already_initialized', true, 'room_id', p_room_id);
  END IF;

  FOR v_round IN SELECT value FROM jsonb_array_elements(p_rounds)
  LOOP
    v_round_number := (v_round->>'round_number')::INTEGER;
    IF v_round_number IS NULL OR v_round_number < 1 THEN
      RAISE EXCEPTION 'Invalid round_number';
    END IF;

    INSERT INTO public.game_room_rounds (
      room_id,
      round_number,
      question_payload,
      opened_at
    )
    VALUES (
      p_room_id,
      v_round_number,
      v_round->'question_payload',
      CASE WHEN v_round_number = 1 THEN now() ELSE NULL END
    );

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.game_rooms
  SET settings = COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object('current_round', 1)
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'round_count', v_count,
    'current_round', 1
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: atomic buzz claim
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.buzz_in(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round public.game_room_rounds%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM public.game_room_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Round already resolved';
  END IF;

  IF v_round.opened_at IS NULL THEN
    RAISE EXCEPTION 'Round is not open yet';
  END IF;

  IF NOT public._buzz_in_is_playing_participant(v_round.room_id, v_user) THEN
    RAISE EXCEPTION 'Only playing participants can buzz';
  END IF;

  IF v_round.buzzed_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'buzzed_by', v_round.buzzed_by,
      'buzzed_at', v_round.buzzed_at
    );
  END IF;

  UPDATE public.game_room_rounds
  SET buzzed_by = v_user, buzzed_at = now()
  WHERE id = p_round_id
    AND buzzed_by IS NULL
    AND resolved_at IS NULL
  RETURNING * INTO v_round;

  IF NOT FOUND THEN
    SELECT * INTO v_round FROM public.game_room_rounds WHERE id = p_round_id;
    RETURN jsonb_build_object(
      'claimed', false,
      'buzzed_by', v_round.buzzed_by,
      'buzzed_at', v_round.buzzed_at
    );
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'buzzed_by', v_round.buzzed_by,
    'buzzed_at', v_round.buzzed_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit answer (buzzer only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_buzz_answer(
  p_round_id UUID,
  p_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round public.game_room_rounds%ROWTYPE;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_advance JSONB;
  v_points CONSTANT INTEGER := 100;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM public.game_room_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF v_round.buzzed_by IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Only the player who buzzed can answer';
  END IF;

  v_correct_answer := trim(v_round.question_payload->>'correct_answer');
  v_is_correct := trim(COALESCE(p_answer, '')) = v_correct_answer;

  UPDATE public.game_room_rounds
  SET
    answer_given = trim(COALESCE(p_answer, '')),
    answer_correct = v_is_correct,
    resolved_at = now()
  WHERE id = p_round_id
  RETURNING * INTO v_round;

  IF v_is_correct THEN
    UPDATE public.game_room_participants
    SET score = score + v_points
    WHERE room_id = v_round.room_id
      AND user_id = v_user
      AND left_at IS NULL;
  END IF;

  v_advance := public._buzz_in_advance_room(v_round.room_id, v_round.round_number);

  RETURN jsonb_build_object(
    'resolved', true,
    'answer_correct', v_is_correct,
    'correct_answer', v_correct_answer,
    'advance', v_advance
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: timeout resolution (client-triggered; server validates elapsed time)
-- Buzz window: 12s after opened_at with no buzz
-- Answer window: 7s after buzzed_at with no answer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_buzz_in_timeout(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round public.game_room_rounds%ROWTYPE;
  v_correct_answer TEXT;
  v_advance JSONB;
  v_buzz_window CONSTANT INTERVAL := interval '12 seconds';
  v_answer_window CONSTANT INTERVAL := interval '7 seconds';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM public.game_room_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF NOT public._game_room_is_active_participant(v_round.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF v_round.opened_at IS NULL THEN
    RAISE EXCEPTION 'Round is not open yet';
  END IF;

  v_correct_answer := trim(v_round.question_payload->>'correct_answer');

  IF v_round.buzzed_by IS NULL THEN
    IF now() < v_round.opened_at + v_buzz_window THEN
      RAISE EXCEPTION 'Buzz window has not elapsed';
    END IF;

    UPDATE public.game_room_rounds
    SET
      answer_given = NULL,
      answer_correct = false,
      resolved_at = now()
    WHERE id = p_round_id
    RETURNING * INTO v_round;
  ELSE
    IF now() < v_round.buzzed_at + v_answer_window THEN
      RAISE EXCEPTION 'Answer window has not elapsed';
    END IF;

    UPDATE public.game_room_rounds
    SET
      answer_given = COALESCE(answer_given, ''),
      answer_correct = false,
      resolved_at = now()
    WHERE id = p_round_id
      AND resolved_at IS NULL
    RETURNING * INTO v_round;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('already_resolved', true);
    END IF;
  END IF;

  v_advance := public._buzz_in_advance_room(v_round.room_id, v_round.round_number);

  RETURN jsonb_build_object(
    'resolved', true,
    'timed_out', true,
    'answer_correct', false,
    'correct_answer', v_correct_answer,
    'advance', v_advance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buzz_in_initialize_rounds(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buzz_in(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_buzz_answer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_buzz_in_timeout(UUID) TO authenticated;
-- Server-side stuck-round sweep + host recover: also run buzz-in-round-recovery.sql.
-- Server-side stuck-round sweep + host recover: run buzz-in-round-recovery.sql after this file.

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_rounds;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
