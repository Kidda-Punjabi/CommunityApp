-- =============================================================================
-- Jeopardy only: server-side stuck-tile recovery
-- Does not alter Buzz-in, Point Race, Chaṛo Pauṛi, or shared ladder/race tables.
-- Game windows stay the existing 12s buzz / 7s answer intervals.
-- =============================================================================

CREATE OR REPLACE FUNCTION public._jeopardy_resolve_timeout_tile(p_tile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tile public.game_room_jeopardy_tiles%ROWTYPE;
  v_room public.game_rooms%ROWTYPE;
  v_buzz_window CONSTANT INTERVAL := interval '12 seconds';
  v_answer_window CONSTANT INTERVAL := interval '7 seconds';
  v_result JSONB;
BEGIN
  SELECT * INTO v_tile
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_tile.room_id;

  IF NOT FOUND OR v_room.game_type <> 'jeopardy' THEN
    RAISE EXCEPTION 'Not a jeopardy tile';
  END IF;

  IF v_room.status <> 'in_progress' THEN
    RETURN jsonb_build_object('already_resolved', true, 'room_status', v_room.status);
  END IF;

  IF v_tile.resolved_at IS NOT NULL OR v_tile.status = 'resolved' THEN
    RETURN jsonb_build_object('already_resolved', true);
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
    IF v_tile.buzzed_at IS NULL OR now() < v_tile.buzzed_at + v_answer_window THEN
      RAISE EXCEPTION 'Answer window has not elapsed';
    END IF;

    v_result := public._jeopardy_resolve_tile(
      p_tile_id,
      COALESCE(v_tile.answer_given, ''),
      false,
      false
    );
  END IF;

  RETURN v_result || jsonb_build_object('timed_out', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_jeopardy_timeout(p_tile_id UUID)
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
  FROM public.game_room_jeopardy_tiles
  WHERE id = p_tile_id;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  IF NOT public._game_room_is_active_participant(v_room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  RETURN public._jeopardy_resolve_timeout_tile(p_tile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_stuck_jeopardy_tile(p_tile_id UUID)
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
  WHERE id = p_tile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tile not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE id = v_tile.room_id;

  IF NOT FOUND OR v_room.game_type <> 'jeopardy' THEN
    RAISE EXCEPTION 'Not a jeopardy tile';
  END IF;

  IF v_room.host_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Only the host can recover a stuck tile';
  END IF;

  IF NOT public._game_room_is_active_participant(v_tile.room_id, v_user) THEN
    RAISE EXCEPTION 'Not a participant in this room';
  END IF;

  RETURN public._jeopardy_resolve_timeout_tile(p_tile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_stuck_jeopardy_tiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tile RECORD;
  v_resolved INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  FOR v_tile IN
    SELECT t.id
    FROM public.game_room_jeopardy_tiles t
    INNER JOIN public.game_rooms g ON g.id = t.room_id
    WHERE g.game_type = 'jeopardy'
      AND g.status = 'in_progress'
      AND t.status = 'active'
      AND t.resolved_at IS NULL
      AND t.opened_at IS NOT NULL
      AND (
        (t.buzzed_by IS NULL AND now() >= t.opened_at + interval '12 seconds')
        OR (
          t.buzzed_by IS NOT NULL
          AND t.buzzed_at IS NOT NULL
          AND now() >= t.buzzed_at + interval '7 seconds'
        )
      )
    ORDER BY t.opened_at
  LOOP
    BEGIN
      PERFORM public._jeopardy_resolve_timeout_tile(v_tile.id);
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

REVOKE ALL ON FUNCTION public._jeopardy_resolve_timeout_tile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stuck_jeopardy_tiles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stuck_jeopardy_tiles() FROM authenticated;
REVOKE ALL ON FUNCTION public.sweep_stuck_jeopardy_tiles() FROM anon;
REVOKE ALL ON FUNCTION public._jeopardy_resolve_timeout_tile(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public._jeopardy_resolve_timeout_tile(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.resolve_jeopardy_timeout(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_jeopardy_tile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stuck_jeopardy_tiles() TO service_role;

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
      WHERE jobname = 'sweep-stuck-jeopardy-tiles';
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      PERFORM cron.schedule(
        'sweep-stuck-jeopardy-tiles',
        '10 seconds',
        'SELECT public.sweep_stuck_jeopardy_tiles()'
      );
    EXCEPTION
      WHEN OTHERS THEN
        BEGIN
          PERFORM cron.schedule(
            'sweep-stuck-jeopardy-tiles',
            '* * * * *',
            'SELECT public.sweep_stuck_jeopardy_tiles()'
          );
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Could not schedule jeopardy sweep cron: %', SQLERRM;
        END;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
