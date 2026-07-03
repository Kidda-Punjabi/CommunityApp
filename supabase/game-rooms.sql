-- =============================================================================
-- Kidda — Group game rooms (shared lobby for Buzz-in, Jeopardy, etc.)
-- Run in Supabase SQL Editor
-- Real-time: Postgres Changes on game_rooms + game_room_participants (same as Battle Mode)
-- Join codes: SECURITY DEFINER RPCs (same pattern as battle_create_session / battle_join_session)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.game_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  game_type   TEXT NOT NULL
    CHECK (game_type IN (
      'buzz_in',
      'jeopardy',
      'chado_pauri_group',
      'sentence_builder_group'
    )),
  join_code   TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'in_progress', 'completed', 'cancelled')),
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.game_room_participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  is_host     BOOLEAN NOT NULL DEFAULT false,
  is_playing  BOOLEAN NOT NULL DEFAULT true,
  score       INTEGER NOT NULL DEFAULT 0,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_host
  ON public.game_rooms (host_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_join_code
  ON public.game_rooms (join_code);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status
  ON public.game_rooms (status)
  WHERE status = 'lobby';
CREATE INDEX IF NOT EXISTS idx_game_room_participants_room
  ON public.game_room_participants (room_id)
  WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_game_room_participants_user
  ON public.game_room_participants (user_id);

COMMENT ON TABLE public.game_rooms IS
  'Shared lobby rooms for group games. Join via join_game_room() RPC — not by direct join_code SELECT.';
COMMENT ON TABLE public.game_room_participants IS
  'Players and hosts in a group game room. Host may set is_playing = false when facilitating only.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._game_room_is_active_participant(p_room_id UUID, p_user_id UUID)
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
  );
$$;

DROP POLICY IF EXISTS "participants can view their game rooms" ON public.game_rooms;
CREATE POLICY "participants can view their game rooms"
  ON public.game_rooms FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(id, auth.uid()));

DROP POLICY IF EXISTS "participants can view room roster" ON public.game_room_participants;
CREATE POLICY "participants can view room roster"
  ON public.game_room_participants FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

GRANT SELECT ON public.game_rooms TO authenticated;
GRANT SELECT ON public.game_room_participants TO authenticated;

-- ---------------------------------------------------------------------------
-- Join code helper (mirrors _battle_generate_invite_code — no 0/O/1/I)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._game_room_generate_join_code()
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

-- ---------------------------------------------------------------------------
-- RPC: create room (host)
-- Default: host is NOT playing (tutor facilitating). Opt in via lobby toggle.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_game_room(
  p_game_type TEXT,
  p_settings JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_room public.game_rooms%ROWTYPE;
  v_settings JSONB := COALESCE(p_settings, '{}'::jsonb);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_game_type NOT IN (
    'buzz_in', 'jeopardy', 'chado_pauri_group', 'sentence_builder_group'
  ) THEN
    RAISE EXCEPTION 'Invalid game type';
  END IF;

  IF NOT (v_settings ? 'question_count') THEN
    v_settings := v_settings || jsonb_build_object('question_count', 10);
  END IF;

  LOOP
    v_code := public._game_room_generate_join_code();
    BEGIN
      INSERT INTO public.game_rooms (host_id, game_type, join_code, settings)
      VALUES (v_user, p_game_type, v_code, v_settings)
      RETURNING * INTO v_room;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  INSERT INTO public.game_room_participants (room_id, user_id, is_host, is_playing)
  VALUES (v_room.id, v_user, true, false);

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'join_code', v_room.join_code,
    'game_type', v_room.game_type
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: join by code
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.join_game_room(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_code TEXT := upper(trim(p_join_code));
  v_existing public.game_room_participants%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_code = '' THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  SELECT * INTO v_room
  FROM public.game_rooms
  WHERE join_code = v_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status <> 'lobby' THEN
    RAISE EXCEPTION 'This game has already started';
  END IF;

  SELECT * INTO v_existing
  FROM public.game_room_participants
  WHERE room_id = v_room.id AND user_id = v_user;

  IF FOUND THEN
    UPDATE public.game_room_participants
    SET left_at = NULL, joined_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.game_room_participants (room_id, user_id, is_host, is_playing)
    VALUES (
      v_room.id,
      v_user,
      v_user = v_room.host_id,
      v_user <> v_room.host_id
    );
  END IF;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'game_type', v_room.game_type
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: host toggles is_playing
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_game_room_host_playing(
  p_room_id UUID,
  p_is_playing BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND OR v_room.status <> 'lobby' THEN
    RAISE EXCEPTION 'Room is not in lobby';
  END IF;

  IF v_room.host_id <> v_user THEN
    RAISE EXCEPTION 'Only the host can change this setting';
  END IF;

  UPDATE public.game_room_participants
  SET is_playing = p_is_playing
  WHERE room_id = p_room_id AND user_id = v_user AND is_host = true;

  RETURN jsonb_build_object('is_playing', p_is_playing);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: start game (host only, ≥1 playing participant)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_game_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_playing_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.host_id <> v_user THEN
    RAISE EXCEPTION 'Only the host can start the game';
  END IF;

  IF v_room.status <> 'lobby' THEN
    RAISE EXCEPTION 'This game has already started';
  END IF;

  SELECT count(*)::INTEGER INTO v_playing_count
  FROM public.game_room_participants
  WHERE room_id = p_room_id
    AND left_at IS NULL
    AND is_playing = true;

  IF v_playing_count < 1 THEN
    RAISE EXCEPTION 'Need at least one player to start';
  END IF;

  UPDATE public.game_rooms
  SET status = 'in_progress', started_at = now()
  WHERE id = p_room_id
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'room_id', v_room.id,
    'game_type', v_room.game_type,
    'status', v_room.status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: leave lobby (host leaving cancels the room)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.leave_game_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_participant public.game_room_participants%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  SELECT * INTO v_participant
  FROM public.game_room_participants
  WHERE room_id = p_room_id AND user_id = v_user;

  IF NOT FOUND OR v_participant.left_at IS NOT NULL THEN
    RAISE EXCEPTION 'You are not in this room';
  END IF;

  UPDATE public.game_room_participants
  SET left_at = now()
  WHERE id = v_participant.id;

  IF v_room.status = 'lobby' AND v_room.host_id = v_user THEN
    UPDATE public.game_rooms
    SET status = 'cancelled', ended_at = now()
    WHERE id = p_room_id;
  END IF;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'cancelled', v_room.status = 'lobby' AND v_room.host_id = v_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_game_room(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_game_room(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_game_room_host_playing(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_game_room(UUID) TO authenticated;

-- Realtime (Postgres Changes — same as battle_sessions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_room_participants;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
