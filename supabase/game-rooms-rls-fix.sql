-- Fix: 42P17 infinite recursion on game_room_participants RLS
-- The roster policy must not subquery the same table; use the SECURITY DEFINER helper instead.

DROP POLICY IF EXISTS "participants can view room roster" ON public.game_room_participants;
CREATE POLICY "participants can view room roster"
  ON public.game_room_participants FOR SELECT TO authenticated
  USING (public._game_room_is_active_participant(room_id, auth.uid()));

NOTIFY pgrst, 'reload schema';
