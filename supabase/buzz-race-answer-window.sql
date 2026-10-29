-- Buzz-in / Jeopardy: give the buzzer 15 seconds to answer (was 7).
-- Yesterday's Community game showed 5 of 7 buzzed rounds timing out before the
-- answer arrived, so correct taps were recorded as blank/wrong.
-- Must match BUZZ_RACE_ANSWER_WINDOW_MS in src/lib/group-games/buzz-race-constants.ts.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        '_buzz_in_resolve_timeout_round',
        '_buzz_in_try_timeout_round',
        '_jeopardy_resolve_timeout_tile',
        'sweep_stuck_buzz_in_rounds',
        'sweep_stuck_jeopardy_tiles'
      )
  LOOP
    EXECUTE replace(r.def, 'interval ''7 seconds''', 'interval ''15 seconds''');
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
