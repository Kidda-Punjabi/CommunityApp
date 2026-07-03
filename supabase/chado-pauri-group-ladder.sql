-- =============================================================================
-- Kidda — Chado Pauri group (Millionaire-style ladder, room-scoped)
-- Run after game-rooms.sql
-- Question/lifeline logic ported from solo Chado Pauri (TS); RPCs mirror group-game patterns.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.game_room_ladder_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  turn_order      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed')),
  current_rung    INTEGER NOT NULL DEFAULT 0,
  final_score     INTEGER,
  half_half_used  BOOLEAN NOT NULL DEFAULT false,
  ask_tutor_used  BOOLEAN NOT NULL DEFAULT false,
  ask_room_used   BOOLEAN NOT NULL DEFAULT false,
  tutor_hint      TEXT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, player_id),
  UNIQUE (room_id, turn_order),
  CONSTRAINT game_room_ladder_runs_rung_bounds CHECK (current_rung >= 0 AND current_rung <= 9)
);

CREATE TABLE IF NOT EXISTS public.game_room_ladder_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID NOT NULL REFERENCES public.game_room_ladder_runs (id) ON DELETE CASCADE,
  rung                INTEGER NOT NULL,
  question_payload    JSONB NOT NULL,
  eliminated_options  JSONB,
  ask_room_opened_at  TIMESTAMPTZ,
  room_vote_tally     JSONB,
  answer_given        TEXT,
  answer_correct      BOOLEAN,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, rung),
  CONSTRAINT game_room_ladder_questions_rung_bounds CHECK (rung >= 1 AND rung <= 9)
);

CREATE TABLE IF NOT EXISTS public.game_room_ladder_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES public.game_room_ladder_questions (id) ON DELETE CASCADE,
  voter_id        UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_game_room_ladder_runs_room
  ON public.game_room_ladder_runs (room_id, turn_order);
CREATE INDEX IF NOT EXISTS idx_game_room_ladder_questions_run
  ON public.game_room_ladder_questions (run_id, rung);
CREATE INDEX IF NOT EXISTS idx_game_room_ladder_votes_question
  ON public.game_room_ladder_votes (question_id);

ALTER TABLE public.game_room_ladder_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_ladder_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_ladder_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants can view ladder runs" ON public.game_room_ladder_runs;
CREATE POLICY "participants can view ladder runs"
  ON public.game_room_ladder_runs FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

DROP POLICY IF EXISTS "participants can view ladder questions" ON public.game_room_ladder_questions;
CREATE POLICY "participants can view ladder questions"
  ON public.game_room_ladder_questions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.game_room_ladder_runs r
      WHERE r.id = game_room_ladder_questions.run_id
        AND public._game_room_is_active_participant(r.room_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "participants can view ladder votes" ON public.game_room_ladder_votes;
CREATE POLICY "participants can view ladder votes"
  ON public.game_room_ladder_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_room_ladder_questions q
      JOIN public.game_room_ladder_runs r ON r.id = q.run_id
      WHERE q.id = game_room_ladder_votes.question_id
        AND public._game_room_is_active_participant(r.room_id, auth.uid())
    )
  );

GRANT SELECT ON public.game_room_ladder_runs TO authenticated;
GRANT SELECT ON public.game_room_ladder_questions TO authenticated;
GRANT SELECT ON public.game_room_ladder_votes TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._ladder_point_value(p_rung INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ARRAY[1, 2, 4, 8, 16, 32, 50, 75, 100])[p_rung];
$$;

CREATE OR REPLACE FUNCTION public._ladder_locked_score(p_cleared_rungs INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cleared_rungs <= 0 THEN 0
    ELSE public._ladder_point_value(p_cleared_rungs)
  END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_get_run_for_question(p_question_id UUID)
RETURNS public.game_room_ladder_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.game_room_ladder_runs;
BEGIN
  SELECT r.* INTO v_run
  FROM public.game_room_ladder_questions q
  JOIN public.game_room_ladder_runs r ON r.id = q.run_id
  WHERE q.id = p_question_id;

  RETURN v_run;
END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_activate_next_run(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next public.game_room_ladder_runs%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_next
  FROM public.game_room_ladder_runs
  WHERE room_id = p_room_id AND status = 'pending'
  ORDER BY turn_order ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.game_rooms
    SET status = 'completed', ended_at = now()
    WHERE id = p_room_id AND status = 'in_progress'
    RETURNING * INTO v_room;

    RETURN jsonb_build_object('game_completed', true);
  END IF;

  UPDATE public.game_room_ladder_runs
  SET status = 'active', started_at = now(), current_rung = 0
  WHERE id = v_next.id
  RETURNING * INTO v_next;

  RETURN jsonb_build_object(
    'game_completed', false,
    'activated_run_id', v_next.id,
    'player_id', v_next.player_id,
    'need_question_rung', 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_complete_run(
  p_run_id UUID,
  p_final_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_advance JSONB;
BEGIN
  UPDATE public.game_room_ladder_runs
  SET
    status = 'completed',
    final_score = p_final_score,
    ended_at = now()
  WHERE id = p_run_id
  RETURNING * INTO v_run;

  UPDATE public.game_room_participants
  SET score = score + p_final_score
  WHERE room_id = v_run.room_id
    AND user_id = v_run.player_id
    AND left_at IS NULL;

  v_advance := public._ladder_activate_next_run(v_run.room_id);

  RETURN jsonb_build_object(
    'run_id', v_run.id,
    'final_score', p_final_score,
    'advance', v_advance
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: initialize game (runs from join order + first question)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ladder_initialize_game(
  p_room_id UUID,
  p_first_question JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_participant RECORD;
  v_order INTEGER := 0;
  v_first_run_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND OR v_room.game_type <> 'chado_pauri_group' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Room is not an active Chado Pauri group game';
  END IF;

  IF NOT public._game_room_is_active_participant(p_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  IF EXISTS (SELECT 1 FROM public.game_room_ladder_runs WHERE room_id = p_room_id) THEN
    RETURN jsonb_build_object('already_initialized', true);
  END IF;

  FOR v_participant IN
    SELECT user_id
    FROM public.game_room_participants
    WHERE room_id = p_room_id
      AND left_at IS NULL
      AND is_playing = true
    ORDER BY joined_at ASC
  LOOP
    v_order := v_order + 1;
    INSERT INTO public.game_room_ladder_runs (room_id, player_id, turn_order, status)
    VALUES (p_room_id, v_participant.user_id, v_order, 'pending');
  END LOOP;

  IF v_order = 0 THEN
    RAISE EXCEPTION 'No playing participants';
  END IF;

  UPDATE public.game_room_ladder_runs
  SET status = 'active', started_at = now()
  WHERE room_id = p_room_id AND turn_order = 1
  RETURNING id INTO v_first_run_id;

  INSERT INTO public.game_room_ladder_questions (run_id, rung, question_payload)
  VALUES (v_first_run_id, 1, p_first_question);

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'run_count', v_order,
    'active_run_id', v_first_run_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: add question for a rung (after server generates in app layer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ladder_add_question(
  p_run_id UUID,
  p_rung INTEGER,
  p_question JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_question public.game_room_ladder_questions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = p_run_id FOR UPDATE;

  IF NOT FOUND OR v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Run is not active';
  END IF;

  IF NOT public._game_room_is_active_participant(v_run.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  INSERT INTO public.game_room_ladder_questions (run_id, rung, question_payload)
  VALUES (p_run_id, p_rung, p_question)
  ON CONFLICT (run_id, rung) DO NOTHING
  RETURNING * INTO v_question;

  IF v_question.id IS NULL THEN
    SELECT * INTO v_question
    FROM public.game_room_ladder_questions
    WHERE run_id = p_run_id AND rung = p_rung;
  END IF;

  RETURN jsonb_build_object('question_id', v_question.id, 'rung', v_question.rung);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit answer
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_ladder_answer(
  p_question_id UUID,
  p_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_complete JSONB;
  v_final_score INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question
  FROM public.game_room_ladder_questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  SELECT * INTO v_run
  FROM public.game_room_ladder_runs
  WHERE id = v_question.run_id
  FOR UPDATE;

  IF v_run.player_id <> v_user THEN
    RAISE EXCEPTION 'Only the hot-seat player can answer';
  END IF;

  IF v_question.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF v_run.status <> 'active' THEN
    RAISE EXCEPTION 'Run is not active';
  END IF;

  v_correct_answer := trim(v_question.question_payload->>'correct_answer');
  v_is_correct := trim(COALESCE(p_answer, '')) = v_correct_answer;

  UPDATE public.game_room_ladder_questions
  SET
    answer_given = trim(COALESCE(p_answer, '')),
    answer_correct = v_is_correct,
    resolved_at = now()
  WHERE id = p_question_id;

  IF v_is_correct THEN
    UPDATE public.game_room_ladder_runs
    SET current_rung = current_rung + 1
    WHERE id = v_run.id
    RETURNING * INTO v_run;

    IF v_run.current_rung >= 9 THEN
      v_complete := public._ladder_complete_run(v_run.id, 100);
      RETURN jsonb_build_object(
        'correct', true,
        'run_completed', true,
        'final_score', 100,
        'run_id', v_run.id,
        'advance', v_complete->'advance'
      );
    END IF;

    RETURN jsonb_build_object(
      'correct', true,
      'run_completed', false,
      'current_rung', v_run.current_rung,
      'run_id', v_run.id,
      'need_question_rung', v_run.current_rung + 1
    );
  END IF;

  v_final_score := public._ladder_locked_score(v_run.current_rung);
  v_complete := public._ladder_complete_run(v_run.id, v_final_score);

  RETURN jsonb_build_object(
    'correct', false,
    'run_completed', true,
    'final_score', v_final_score,
    'run_id', v_run.id,
    'advance', v_complete->'advance'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Half & Half (ported elimination — keep correct + 1 random wrong)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.use_half_half(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_correct TEXT;
  v_wrong TEXT[];
  v_keep_idx INTEGER;
  v_eliminated JSONB;
  v_i INTEGER;
  v_elim_arr TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;

  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;

  IF v_run.player_id <> v_user OR v_run.half_half_used OR v_question.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot use Half & Half on this question';
  END IF;

  v_correct := trim(v_question.question_payload->>'correct_answer');

  SELECT coalesce(array_agg(opt), ARRAY[]::TEXT[])
  INTO v_wrong
  FROM (
    SELECT trim(value::text) AS opt
    FROM jsonb_array_elements_text(v_question.question_payload->'options') AS value
    WHERE trim(value::text) <> v_correct
  ) sub;

  IF array_length(v_wrong, 1) IS NULL OR array_length(v_wrong, 1) < 2 THEN
    RAISE EXCEPTION 'Not enough options for Half & Half';
  END IF;

  v_keep_idx := 1 + floor(random() * array_length(v_wrong, 1))::int;

  FOR v_i IN 1..array_length(v_wrong, 1) LOOP
    IF v_i <> v_keep_idx THEN
      v_elim_arr := array_append(v_elim_arr, v_wrong[v_i]);
    END IF;
  END LOOP;

  v_eliminated := to_jsonb(v_elim_arr);

  UPDATE public.game_room_ladder_questions
  SET eliminated_options = v_eliminated
  WHERE id = p_question_id;

  UPDATE public.game_room_ladder_runs
  SET half_half_used = true
  WHERE id = v_run.id;

  RETURN jsonb_build_object('eliminated_options', v_eliminated);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Ask the Tutor (computed hint — same categories as solo Chado Pauri)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.use_ask_tutor(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_category TEXT;
  v_tags JSONB;
  v_hint TEXT := '';
  v_tag TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;

  IF v_run.player_id <> v_user OR v_run.ask_tutor_used OR v_question.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot use Ask the Tutor on this question';
  END IF;

  v_category := v_question.question_payload->>'category';
  v_tags := coalesce(v_question.question_payload->'topic_tags', '[]'::jsonb);

  IF v_category = 'alphabet' THEN
    v_hint := 'This card is from the alphabet — think about letters and sounds.';
  ELSIF v_category = 'vocab' THEN
    v_hint := 'This is a vocabulary word — consider everyday meanings.';
  ELSIF v_category = 'sentences' THEN
    v_hint := 'This is a short sentence or phrase — read the prompt carefully.';
  ELSIF v_category IS NOT NULL AND v_category <> '' THEN
    v_hint := 'Category: ' || initcap(replace(v_category, '_', ' ')) || '.';
  END IF;

  IF jsonb_array_length(v_tags) > 0 THEN
    v_tag := initcap(replace(v_tags->>0, '_', ' '));
    IF jsonb_array_length(v_tags) > 1 THEN
      v_tag := v_tag || ', ' || initcap(replace(v_tags->>1, '_', ' '));
    END IF;
    IF v_hint <> '' THEN
      v_hint := v_hint || ' Related topics: ' || v_tag || '.';
    ELSE
      v_hint := 'Related topics: ' || v_tag || '.';
    END IF;
  END IF;

  IF v_hint = '' THEN
    v_hint := 'Rule out answers that don''t fit the prompt — the correct choice matches the front of the card.';
  END IF;

  UPDATE public.game_room_ladder_runs
  SET ask_tutor_used = true, tutor_hint = v_hint
  WHERE id = v_run.id;

  RETURN jsonb_build_object('hint', v_hint);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: Ask the Room
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.use_ask_room(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;

  IF v_run.player_id <> v_user OR v_run.ask_room_used OR v_question.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot use Ask the Room on this question';
  END IF;

  UPDATE public.game_room_ladder_questions
  SET ask_room_opened_at = now()
  WHERE id = p_question_id;

  UPDATE public.game_room_ladder_runs
  SET ask_room_used = true
  WHERE id = v_run.id;

  RETURN jsonb_build_object('ask_room_opened_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_room_vote(
  p_question_id UUID,
  p_option TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT q.* INTO v_question
  FROM public.game_room_ladder_questions q
  WHERE q.id = p_question_id;

  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id;

  IF v_question.ask_room_opened_at IS NULL OR v_question.room_vote_tally IS NOT NULL THEN
    RAISE EXCEPTION 'Voting is not open';
  END IF;

  IF v_run.player_id = v_user THEN
    RAISE EXCEPTION 'Hot-seat player cannot vote';
  END IF;

  IF NOT public._buzz_in_is_playing_participant(v_run.room_id, v_user) THEN
    RAISE EXCEPTION 'Only playing participants can vote';
  END IF;

  INSERT INTO public.game_room_ladder_votes (question_id, voter_id, selected_option)
  VALUES (p_question_id, v_user, trim(p_option))
  ON CONFLICT (question_id, voter_id)
  DO UPDATE SET selected_option = EXCLUDED.selected_option, created_at = now();

  RETURN jsonb_build_object('voted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_ladder_room_voting(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_question public.game_room_ladder_questions%ROWTYPE;
  v_run public.game_room_ladder_runs%ROWTYPE;
  v_vote_window CONSTANT INTERVAL := interval '12 seconds';
  v_total INTEGER;
  v_tally JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id;

  IF v_question.room_vote_tally IS NOT NULL THEN
    RETURN jsonb_build_object('already_closed', true, 'tally', v_question.room_vote_tally);
  END IF;

  IF v_question.ask_room_opened_at IS NULL THEN
    RAISE EXCEPTION 'Voting was not opened';
  END IF;

  IF NOT public._game_room_is_active_participant(v_run.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF now() < v_question.ask_room_opened_at + v_vote_window THEN
    RAISE EXCEPTION 'Voting window has not elapsed';
  END IF;

  SELECT count(*)::INTEGER INTO v_total
  FROM public.game_room_ladder_votes
  WHERE question_id = p_question_id;

  SELECT coalesce(jsonb_object_agg(selected_option, pct), '{}'::jsonb)
  INTO v_tally
  FROM (
    SELECT
      selected_option,
      round(100.0 * count(*)::numeric / GREATEST(v_total, 1), 1) AS pct
    FROM public.game_room_ladder_votes
    WHERE question_id = p_question_id
    GROUP BY selected_option
  ) counts;

  UPDATE public.game_room_ladder_questions
  SET room_vote_tally = v_tally
  WHERE id = p_question_id;

  RETURN jsonb_build_object('tally', v_tally, 'vote_count', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ladder_initialize_game(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ladder_add_question(UUID, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ladder_answer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_half_half(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_ask_tutor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_ask_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_room_vote(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_ladder_room_voting(UUID) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_ladder_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_ladder_runs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_ladder_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_ladder_questions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_ladder_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_ladder_votes;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
