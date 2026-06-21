-- =============================================================================
-- Admin announcements: optional targeted audience (specific members)
-- Run in Supabase SQL Editor after friends-notifications.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_publish_announcement(
  p_title TEXT,
  p_body TEXT,
  p_recipient_user_ids UUID[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_id UUID;
  v_user UUID;
  v_targeted BOOLEAN;
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' OR p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Title and body required';
  END IF;

  v_targeted := p_recipient_user_ids IS NOT NULL AND array_length(p_recipient_user_ids, 1) > 0;

  IF v_targeted AND array_length(p_recipient_user_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Too many recipients (max 500)';
  END IF;

  INSERT INTO public.announcements (title, body, created_by)
  VALUES (btrim(p_title), btrim(p_body), v_admin)
  RETURNING id INTO v_id;

  IF v_targeted THEN
    FOR v_user IN
      SELECT DISTINCT p.id
      FROM public.profiles p
      WHERE p.id = ANY (p_recipient_user_ids)
    LOOP
      PERFORM public._create_notification(
        v_user,
        'announcement',
        v_admin,
        jsonb_build_object(
          'announcement_id', v_id,
          'title', btrim(p_title),
          'body', btrim(p_body)
        )
      );
    END LOOP;
  ELSE
    FOR v_user IN SELECT id FROM public.profiles LOOP
      PERFORM public._create_notification(
        v_user,
        'announcement',
        v_admin,
        jsonb_build_object(
          'announcement_id', v_id,
          'title', btrim(p_title),
          'body', btrim(p_body)
        )
      );
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(TEXT, TEXT, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
