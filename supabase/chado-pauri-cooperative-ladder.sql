-- =============================================================================
-- Chado Pauri group — cooperative shared ladder (one run per room)
-- Run after chado-pauri-group-ladder.sql (+ chado-pauri-ask-room-audience.sql if applied)
-- In-flight rooms created under per-player sequential init should be abandoned.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._ladder_simulate_audience_tally(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_correct TEXT;
  v_wrong TEXT[];
  v_n INTEGER;
  v_correct_pct INTEGER;
  v_pool INTEGER;
  v_i INTEGER;
  v_share INTEGER;
  v_tally JSONB := '{}'::jsonb;
BEGIN
  v_correct := trim(COALESCE(p_payload->>'correct_answer', ''));

  SELECT COALESCE(array_agg(trim(opt) ORDER BY random()), ARRAY[]::TEXT[])
  INTO v_wrong
  FROM jsonb_array_elements_text(COALESCE(p_payload->'options', '[]'::jsonb)) AS opt
  WHERE trim(opt) <> v_correct;

  v_n := COALESCE(array_length(v_wrong, 1), 0);

  IF v_n = 0 THEN
    RETURN jsonb_build_object(v_correct, 100);
  END IF;

  v_correct_pct := 50 + floor(random() * 36)::INTEGER;
  v_pool := 100 - v_correct_pct - v_n;

  IF v_pool < 0 THEN
    v_correct_pct := GREATEST(1, 100 - v_n - 1);
    v_pool := 100 - v_correct_pct - v_n;
  END IF;

  FOR v_i IN 1 .. v_n LOOP
    IF v_i = v_n THEN
      v_share := v_pool;
    ELSE
      v_share := floor(random() * (v_pool + 1))::INTEGER;
      v_share := LEAST(v_share, v_pool - (v_n - v_i));
    END IF;
    v_tally := v_tally || jsonb_build_object(v_wrong[v_i], 1 + v_share);
    v_pool := v_pool - v_share;
  END LOOP;

  v_tally := v_tally || jsonb_build_object(v_correct, v_correct_pct);
  RETURN v_tally;
END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_turn_order_from_settings(p_settings JSONB)
RETURNS UUID[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_arr JSONB;
  v_result UUID[] := ARRAY[]::UUID[];
  v_i INTEGER;
  v_id UUID;
BEGIN
  v_arr := COALESCE(p_settings->'ladder_turn_order', '[]'::jsonb);
  IF jsonb_typeof(v_arr) <> 'array' THEN
    RETURN v_result;
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(v_arr) - 1 LOOP
    BEGIN
      v_id := (v_arr ->> v_i)::UUID;
      v_result := array_append(v_result, v_id);
    EXCEPTION
      WHEN others THEN
        NULL;
    END;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_advance_hot_seat(p_room_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_order UUID[];
  v_len INTEGER;
  v_i INTEGER;
  v_idx INTEGER;
  v_next UUID;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;
  v_order := public._ladder_turn_order_from_settings(v_room.settings);
  v_len := COALESCE(array_length(v_order, 1), 0);

  IF v_len = 0 THEN
    RAISE EXCEPTION 'Turn order not configured';
  END IF;

  v_idx := NULL;
  FOR v_i IN 1 .. v_len LOOP
    IF v_order[v_i] = v_room.current_picker_id THEN
      v_idx := v_i;
      EXIT;
    END IF;
  END LOOP;

  IF v_idx IS NULL THEN
    v_next := v_order[1];
  ELSIF v_idx >= v_len THEN
    v_next := v_order[1];
  ELSE
    v_next := v_order[v_idx + 1];
  END IF;

  UPDATE public.game_rooms
  SET current_picker_id = v_next
  WHERE id = p_room_id;

  UPDATE public.game_room_ladder_runs
  SET player_id = v_next, tutor_hint = NULL
  WHERE room_id = p_room_id AND status = 'active';

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public._ladder_end_cooperative_game(
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
  v_room public.game_rooms%ROWTYPE;
BEGIN
  UPDATE public.game_room_ladder_runs
  SET
    status = 'completed',
    final_score = p_final_score,
    ended_at = now()
  WHERE id = p_run_id
  RETURNING * INTO v_run;

  UPDATE public.game_room_participants
  SET score = p_final_score
  WHERE room_id = v_run.room_id
    AND left_at IS NULL
    AND is_playing = true;

  UPDATE public.game_rooms
  SET status = 'completed', ended_at = now()
  WHERE id = v_run.room_id AND status = 'in_progress'
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'game_completed', true,
    'final_score', p_final_score,
    'room_id', v_run.room_id
  );
END;
$$;

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
  v_turn_order UUID[] := ARRAY[]::UUID[];
  v_first_player UUID;
  v_run_id UUID;
  v_settings JSONB;
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
    v_turn_order := array_append(v_turn_order, v_participant.user_id);
  END LOOP;

  IF COALESCE(array_length(v_turn_order, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No playing participants';
  END IF;

  v_first_player := v_turn_order[1];

  v_settings := COALESCE(v_room.settings, '{}'::jsonb)
    || jsonb_build_object(
      'ladder_turn_order', to_jsonb(v_turn_order),
      'ladder_half_half_used', false,
      'ladder_ask_tutor_used', false,
      'ladder_ask_room_uses', 0
    );

  UPDATE public.game_rooms
  SET
    settings = v_settings,
    current_picker_id = v_first_player
  WHERE id = p_room_id;

  INSERT INTO public.game_room_ladder_runs (
    room_id, player_id, turn_order, status, current_rung, started_at
  )
  VALUES (p_room_id, v_first_player, 1, 'active', 0, now())
  RETURNING id INTO v_run_id;

  INSERT INTO public.game_room_ladder_questions (run_id, rung, question_payload)
  VALUES (v_run_id, 1, p_first_question);

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'player_count', array_length(v_turn_order, 1),
    'active_run_id', v_run_id,
    'current_picker_id', v_first_player
  );
END;
$$;

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
  v_room public.game_rooms%ROWTYPE;
  v_is_correct BOOLEAN;
  v_end JSONB;
  v_final_score INTEGER;
  v_next_picker UUID;
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

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_run.room_id
  FOR UPDATE;

  IF v_room.current_picker_id IS DISTINCT FROM v_user AND v_run.player_id <> v_user THEN
    RAISE EXCEPTION 'Only the hot-seat player can answer';
  END IF;

  IF v_question.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  IF v_run.status <> 'active' OR v_room.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Run is not active';
  END IF;

  v_is_correct := trim(COALESCE(p_answer, '')) = trim(v_question.question_payload->>'correct_answer');

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
      v_end := public._ladder_end_cooperative_game(v_run.id, 100);
      RETURN jsonb_build_object(
        'correct', true,
        'run_completed', true,
        'game_completed', true,
        'final_score', 100,
        'run_id', v_run.id
      );
    END IF;

    v_next_picker := public._ladder_advance_hot_seat(v_run.room_id);

    RETURN jsonb_build_object(
      'correct', true,
      'run_completed', false,
      'current_rung', v_run.current_rung,
      'run_id', v_run.id,
      'need_question_rung', v_run.current_rung + 1,
      'current_picker_id', v_next_picker
    );
  END IF;

  v_final_score := public._ladder_locked_score(v_run.current_rung);
  v_end := public._ladder_end_cooperative_game(v_run.id, v_final_score);

  RETURN jsonb_build_object(
    'correct', false,
    'run_completed', true,
    'game_completed', true,
    'final_score', v_final_score,
    'run_id', v_run.id
  );
END;
$$;

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
  v_room public.game_rooms%ROWTYPE;
  v_correct TEXT;
  v_wrong TEXT[];
  v_keep_idx INTEGER;
  v_eliminated JSONB;
  v_i INTEGER;
  v_elim_arr TEXT[] := ARRAY[]::TEXT[];
  v_used BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question not found'; END IF;

  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = v_run.room_id FOR UPDATE;

  v_used := COALESCE((v_room.settings->>'ladder_half_half_used')::BOOLEAN, false);

  IF v_room.current_picker_id IS DISTINCT FROM v_user AND v_run.player_id <> v_user THEN
    RAISE EXCEPTION 'Only the hot-seat player can use lifelines';
  END IF;

  IF v_used OR v_question.resolved_at IS NOT NULL THEN
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

  UPDATE public.game_rooms
  SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{ladder_half_half_used}', 'true'::jsonb, true)
  WHERE id = v_room.id;

  RETURN jsonb_build_object('eliminated_options', v_eliminated);
END;
$$;

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
  v_room public.game_rooms%ROWTYPE;
  v_category TEXT;
  v_tags JSONB;
  v_hint TEXT := '';
  v_tag TEXT;
  v_used BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = v_run.room_id FOR UPDATE;

  v_used := COALESCE((v_room.settings->>'ladder_ask_tutor_used')::BOOLEAN, false);

  IF v_room.current_picker_id IS DISTINCT FROM v_user AND v_run.player_id <> v_user THEN
    RAISE EXCEPTION 'Only the hot-seat player can use lifelines';
  END IF;

  IF v_used OR v_question.resolved_at IS NOT NULL THEN
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
  SET tutor_hint = v_hint
  WHERE id = v_run.id;

  UPDATE public.game_rooms
  SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{ladder_ask_tutor_used}', 'true'::jsonb, true)
  WHERE id = v_room.id;

  RETURN jsonb_build_object('hint', v_hint);
END;
$$;

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
  v_room public.game_rooms%ROWTYPE;
  v_uses INTEGER;
  v_tally JSONB;
  v_max_uses CONSTANT INTEGER := 3;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_question FROM public.game_room_ladder_questions WHERE id = p_question_id FOR UPDATE;
  SELECT * INTO v_run FROM public.game_room_ladder_runs WHERE id = v_question.run_id FOR UPDATE;
  SELECT * INTO v_room FROM public.game_rooms WHERE id = v_run.room_id FOR UPDATE;

  IF v_room.current_picker_id IS DISTINCT FROM v_user AND v_run.player_id <> v_user THEN
    RAISE EXCEPTION 'Only the hot-seat player can use lifelines';
  END IF;

  IF v_question.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot use Ask the Room on this question';
  END IF;

  IF v_question.room_vote_tally IS NOT NULL THEN
    RAISE EXCEPTION 'Ask the Room already used on this question';
  END IF;

  v_uses := COALESCE((v_room.settings->>'ladder_ask_room_uses')::INTEGER, 0);
  IF v_uses >= v_max_uses THEN
    RAISE EXCEPTION 'No Ask the Room uses remaining for this game';
  END IF;

  v_tally := public._ladder_simulate_audience_tally(v_question.question_payload);

  UPDATE public.game_room_ladder_questions
  SET
    ask_room_opened_at = now(),
    room_vote_tally = v_tally
  WHERE id = p_question_id;

  UPDATE public.game_rooms
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{ladder_ask_room_uses}',
    to_jsonb(v_uses + 1),
    true
  )
  WHERE id = v_room.id;

  RETURN jsonb_build_object(
    'tally', v_tally,
    'uses_remaining', v_max_uses - (v_uses + 1)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
