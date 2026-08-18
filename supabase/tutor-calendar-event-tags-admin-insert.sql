-- Allow master_admin to insert calendar event tags for any tutor (tagged_by = confirming admin).

DROP POLICY IF EXISTS "Master admins insert calendar event tags" ON public.tutor_calendar_event_tags;
CREATE POLICY "Master admins insert calendar event tags"
  ON public.tutor_calendar_event_tags FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin());

NOTIFY pgrst, 'reload schema';
