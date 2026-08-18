-- =============================================================================
-- Buzz-in only: server-side stuck-round recovery
-- Does not alter Jeopardy, Point Race, Chaṛo Pauṛi, or shared ladder/race tables.
-- Game windows stay the existing 12s buzz / 7s answer intervals.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._buzz_in_resolve_timeout_round(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.game_room_rounds%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
  v_correct_answer TEXT;
  v_advance JSONB;
  v_buzz_window CONSTANT INTERVAL := interval '12 seconds';
  v_answer_window CONSTANT INTERVAL := interval '7 seconds';
BEGIN
  SELECT * INTO v_round
  FROM public.game_room_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_round.room_id;

  IF NOT FOUND OR v_room.game_type <> 'buzz_in' THEN
    RAISE EXCEPTION 'Not a buzz-in round';
  END IF;

  IF v_room.status <> 'in_progress' THEN
    RETURN jsonb_build_object('already_resolved', true, 'room_status', v_room.status);
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
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
      AND resolved_at IS NULL
      AND buzzed_by IS NULL
    RETURNING * INTO v_round;
  ELSE
    IF v_round.buzzed_at IS NULL OR now() < v_round.buzzed_at + v_answer_window THEN
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
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('already_resolved', true);
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

CREATE OR REPLACE FUNCTION public.resolve_buzz_in_timeout(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT room_id INTO v_room_id
  FROM public.game_room_rounds
  WHERE id = p_round_id;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF NOT public._game_room_is_active_participant(v_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  RETURN public._buzz_in_resolve_timeout_round(p_round_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_stuck_buzz_in_round(p_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_round public.game_room_rounds%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_round
  FROM public.game_room_rounds
  WHERE id = p_round_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_round.room_id;

  IF NOT FOUND OR v_room.game_type <> 'buzz_in' THEN
    RAISE EXCEPTION 'Not a buzz-in round';
  END IF;

  IF v_room.host_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Only the host can recover a stuck round';
  END IF;

  IF NOT public._game_room_is_active_participant(v_round.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  RETURN public._buzz_in_resolve_timeout_round(p_round_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_stuck_buzz_in_rounds()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round RECORD;
  v_resolved INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_round IN
    SELECT r.id
    FROM public.game_room_rounds r
    INNER JOIN public.game_rooms g ON g.id = r.room_id
    WHERE g.game_type = 'buzz_in'
      AND g.status = 'in_progress'
      AND r.resolved_at IS NULL
      AND r.opened_at IS NOT NULL
      AND (
        (r.buzzed_by IS NULL AND now() >= r.opened_at + interval '12 seconds')
        OR (
          r.buzzed_by IS NOT NULL
          AND r.buzzed_at IS NOT NULL
          AND now() >= r.buzzed_at + interval '7 seconds'
        )
      )
    ORDER BY r.opened_at
  LOOP
    BEGIN
      PERFORM public._buzz_in_resolve_timeout_round(v_round.id);
      v_resolved := v_resolved + 1;
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%has not elapsed%' THEN
          v_skipped := v_skipped + 1;
        ELSE
          v_errors := v_errors + 1;
        END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'resolved', v_resolved,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

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
    AND resolved_at IS NULL
  RETURNING * INTO v_round;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

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

REVOKE ALL ON FUNCTION public._buzz_in_resolve_timeout_round(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stuck_buzz_in_rounds() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_buzz_in_timeout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_buzz_in_round(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_buzz_answer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stuck_buzz_in_rounds() TO service_role;

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'sweep-stuck-buzz-in-rounds';
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      PERFORM cron.schedule(
        'sweep-stuck-buzz-in-rounds',
        '10 seconds',
        'SELECT public.sweep_stuck_buzz_in_rounds()'
      );
    EXCEPTION
      WHEN OTHERS THEN
        BEGIN
          PERFORM cron.schedule(
            'sweep-stuck-buzz-in-rounds',
            '* * * * *',
            'SELECT public.sweep_stuck_buzz_in_rounds()'
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Could not schedule buzz-in sweep cron: %', SQLERRM;
        END;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
