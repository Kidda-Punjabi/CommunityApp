-- =============================================================================
-- Chado Pauri group — simulated Ask the Room + room-wide use pool (3/game)
-- Run in Supabase SQL Editor after chado-pauri-group-ladder.sql
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
  v_opt TEXT;
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

  IF v_run.player_id <> v_user OR v_run.ask_room_used OR v_question.resolved_at IS NOT NULL THEN
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

  UPDATE public.game_room_ladder_runs
  SET ask_room_used = true
  WHERE id = v_run.id;

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
