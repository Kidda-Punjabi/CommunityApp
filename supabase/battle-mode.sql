-- =============================================================================
-- Kidda — Live Battle Mode (real-time 1v1 PvP)
-- Run in Supabase SQL Editor. Independent from friend_game_challenges.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.battle_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_one_id  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  player_two_id  UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  invite_code    TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  game_source    TEXT NOT NULL
    CHECK (game_source IN ('gender_sort', 'conjugation_challenge')),
  player_one_hp  INTEGER NOT NULL DEFAULT 150,
  player_two_hp  INTEGER NOT NULL DEFAULT 150,
  current_round  INTEGER NOT NULL DEFAULT 1,
  winner_id      UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  CONSTRAINT battle_sessions_hp_nonnegative CHECK (
    player_one_hp >= 0 AND player_two_hp >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.battle_rounds (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             UUID NOT NULL REFERENCES public.battle_sessions (id) ON DELETE CASCADE,
  round_number           INTEGER NOT NULL,
  question_payload       JSONB NOT NULL,
  round_started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  player_one_answer      TEXT,
  player_one_answered_at TIMESTAMPTZ,
  player_one_correct     BOOLEAN,
  player_two_answer      TEXT,
  player_two_answered_at TIMESTAMPTZ,
  player_two_correct     BOOLEAN,
  player_one_damage_dealt INTEGER NOT NULL DEFAULT 0,
  player_two_damage_dealt INTEGER NOT NULL DEFAULT 0,
  round_multiplier       NUMERIC NOT NULL DEFAULT 1.0,
  resolved_at            TIMESTAMPTZ,
  UNIQUE (session_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_battle_sessions_player_one
  ON public.battle_sessions (player_one_id);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_player_two
  ON public.battle_sessions (player_two_id);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_invite_code
  ON public.battle_sessions (invite_code);
CREATE INDEX IF NOT EXISTS idx_battle_rounds_session
  ON public.battle_rounds (session_id, round_number);

COMMENT ON TABLE public.battle_sessions IS
  'Live synchronous 1v1 battle matches. Not related to async friend_game_challenges.';
COMMENT ON TABLE public.battle_rounds IS
  'Per-round question snapshot and both players'' answers. Server sets all timestamps.';

-- ---------------------------------------------------------------------------
-- RLS (read-only for clients — writes via SECURITY DEFINER RPCs)
-- ---------------------------------------------------------------------------

ALTER TABLE public.battle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players can view their own sessions" ON public.battle_sessions;
CREATE POLICY "players can view their own sessions"
  ON public.battle_sessions FOR SELECT TO authenticated
  USING (auth.uid() = player_one_id OR auth.uid() = player_two_id);

DROP POLICY IF EXISTS "players can view their own rounds" ON public.battle_rounds;
CREATE POLICY "players can view their own rounds"
  ON public.battle_rounds FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.battle_sessions bs
      WHERE bs.id = battle_rounds.session_id
        AND (bs.player_one_id = auth.uid() OR bs.player_two_id = auth.uid())
    )
  );

GRANT SELECT ON public.battle_sessions TO authenticated;
GRANT SELECT ON public.battle_rounds TO authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._battle_generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT := '';
  v_i INTEGER;
BEGIN
  FOR v_i IN 1..6 LOOP
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public._battle_is_player(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.battle_sessions bs
    WHERE bs.id = p_session_id
      AND (bs.player_one_id = p_user_id OR bs.player_two_id = p_user_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC: create session (waiting)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_create_session(p_game_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_session public.battle_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_source NOT IN ('gender_sort', 'conjugation_challenge') THEN
    RAISE EXCEPTION 'Invalid game_source';
  END IF;

  LOOP
    v_code := public._battle_generate_invite_code();
    BEGIN
      INSERT INTO public.battle_sessions (player_one_id, invite_code, game_source)
      VALUES (v_user, v_code, p_game_source)
      RETURNING * INTO v_session;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'invite_code', v_session.invite_code
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: join session + activate (round 1 created by app layer with question)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_join_session(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE invite_code = upper(trim(p_invite_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF v_session.status <> 'waiting' THEN
    RAISE EXCEPTION 'Battle is no longer waiting for an opponent';
  END IF;

  IF v_session.player_one_id = v_user THEN
    RAISE EXCEPTION 'You cannot join your own battle';
  END IF;

  UPDATE public.battle_sessions
  SET
    player_two_id = v_user,
    status = 'active',
    started_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: insert round (service path — caller must be a player)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_start_round(
  p_session_id UUID,
  p_round_number INTEGER,
  p_question_payload JSONB,
  p_round_multiplier NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_round public.battle_rounds%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._battle_is_player(p_session_id, v_user) THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Battle is not active';
  END IF;

  IF v_session.current_round <> p_round_number THEN
    RAISE EXCEPTION 'Round number mismatch';
  END IF;

  INSERT INTO public.battle_rounds (
    session_id,
    round_number,
    question_payload,
    round_multiplier,
    round_started_at
  )
  VALUES (
    p_session_id,
    p_round_number,
    p_question_payload,
    p_round_multiplier,
    now()
  )
  ON CONFLICT (session_id, round_number) DO NOTHING
  RETURNING * INTO v_round;

  IF v_round.id IS NULL THEN
    SELECT * INTO v_round
    FROM public.battle_rounds
    WHERE session_id = p_session_id AND round_number = p_round_number;
  END IF;

  RETURN jsonb_build_object(
    'round_id', v_round.id,
    'round_number', v_round.round_number,
    'round_started_at', v_round.round_started_at,
    'question_payload', v_round.question_payload
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: record answer (server timestamps only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_record_answer(
  p_session_id UUID,
  p_round_number INTEGER,
  p_answer TEXT,
  p_correct BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_round public.battle_rounds%ROWTYPE;
  v_is_player_one BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Battle not active';
  END IF;

  SELECT * INTO v_round
  FROM public.battle_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Round not found';
  END IF;

  IF v_round.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Round already resolved';
  END IF;

  v_is_player_one := v_session.player_one_id = v_user;

  IF NOT v_is_player_one AND v_session.player_two_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  IF v_is_player_one THEN
    IF v_round.player_one_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already answered';
    END IF;
    UPDATE public.battle_rounds
    SET
      player_one_answer = p_answer,
      player_one_answered_at = now(),
      player_one_correct = p_correct
    WHERE id = v_round.id
    RETURNING * INTO v_round;
  ELSE
    IF v_round.player_two_answered_at IS NOT NULL THEN
      RAISE EXCEPTION 'Already answered';
    END IF;
    UPDATE public.battle_rounds
    SET
      player_two_answer = p_answer,
      player_two_answered_at = now(),
      player_two_correct = p_correct
    WHERE id = v_round.id
    RETURNING * INTO v_round;
  END IF;

  RETURN jsonb_build_object(
    'round', row_to_json(v_round)::jsonb,
    'both_answered', (
      v_round.player_one_answered_at IS NOT NULL
      AND v_round.player_two_answered_at IS NOT NULL
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: apply round resolution (damage computed in app, applied atomically here)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.battle_apply_round_resolution(
  p_session_id UUID,
  p_round_number INTEGER,
  p_player_one_damage_dealt INTEGER,
  p_player_two_damage_dealt INTEGER,
  p_player_one_hp INTEGER,
  p_player_two_hp INTEGER,
  p_winner_id UUID,
  p_session_status TEXT,
  p_start_next_round BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.battle_sessions%ROWTYPE;
  v_round public.battle_rounds%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._battle_is_player(p_session_id, v_user) THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  SELECT * INTO v_round
  FROM public.battle_rounds
  WHERE session_id = p_session_id AND round_number = p_round_number
  FOR UPDATE;

  IF v_round.resolved_at IS NOT NULL THEN
    RETURN jsonb_build_object('already_resolved', true);
  END IF;

  UPDATE public.battle_rounds
  SET
    player_one_damage_dealt = p_player_one_damage_dealt,
    player_two_damage_dealt = p_player_two_damage_dealt,
    resolved_at = now()
  WHERE id = v_round.id;

  UPDATE public.battle_sessions
  SET
    player_one_hp = p_player_one_hp,
    player_two_hp = p_player_two_hp,
    winner_id = p_winner_id,
    status = p_session_status,
    completed_at = CASE WHEN p_session_status = 'completed' THEN now() ELSE completed_at END,
    current_round = CASE
      WHEN p_start_next_round THEN current_round + 1
      ELSE current_round
    END
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'session', row_to_json(v_session)::jsonb,
    'round_number', p_round_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.battle_abandon_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._battle_is_player(p_session_id, v_user) THEN
    RAISE EXCEPTION 'Not a player in this battle';
  END IF;

  UPDATE public.battle_sessions
  SET status = 'abandoned', completed_at = now()
  WHERE id = p_session_id AND status IN ('waiting', 'active');
END;
$$;

GRANT EXECUTE ON FUNCTION public.battle_create_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_join_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_start_round(UUID, INTEGER, JSONB, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_record_answer(UUID, INTEGER, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_apply_round_resolution(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_abandon_session(UUID) TO authenticated;

-- Realtime sync for live battle clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'battle_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'battle_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_rounds;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
