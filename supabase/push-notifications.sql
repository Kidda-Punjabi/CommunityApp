-- Push notifications: device tokens, send log, settings, announcement flag.
-- Apply with the Supabase management API. Ends with a schema reload.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/London';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS send_push boolean NOT NULL DEFAULT false;

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS class_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS homework_due boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS community_sessions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS forum_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS streaks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_recap boolean NOT NULL DEFAULT true;

ALTER TABLE public.homework_due_reminder_logs
  ADD COLUMN IF NOT EXISTS reminder_kind text NOT NULL DEFAULT 'email';

DO $$
DECLARE
  v_name text;
BEGIN
  SELECT con.conname INTO v_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.homework_due_reminder_logs'::regclass
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%reminder_kind%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.homework_due_reminder_logs DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.homework_due_reminder_logs
  DROP CONSTRAINT IF EXISTS homework_due_reminder_logs_kind_key;
ALTER TABLE public.homework_due_reminder_logs
  ADD CONSTRAINT homework_due_reminder_logs_kind_key
  UNIQUE (student_id, session_id, lesson_id, reminder_kind);

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios',
  app_version text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_idx
  ON public.device_push_tokens (user_id)
  WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE SET NULL,
  type text NOT NULL,
  ref_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  error text,
  not_before timestamptz,
  title text,
  body text,
  url text,
  expires_at timestamptz,
  UNIQUE (user_id, type, ref_key)
);

CREATE INDEX IF NOT EXISTS push_send_log_status_idx
  ON public.push_send_log (status, not_before);
CREATE INDEX IF NOT EXISTS push_send_log_sent_idx
  ON public.push_send_log (user_id, sent_at DESC);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push tokens" ON public.device_push_tokens;
CREATE POLICY "Users read own push tokens"
  ON public.device_push_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own push tokens" ON public.device_push_tokens;
CREATE POLICY "Users insert own push tokens"
  ON public.device_push_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own push tokens" ON public.device_push_tokens;
CREATE POLICY "Users update own push tokens"
  ON public.device_push_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own push tokens" ON public.device_push_tokens;
CREATE POLICY "Users delete own push tokens"
  ON public.device_push_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
GRANT ALL ON public.push_send_log TO service_role;

CREATE OR REPLACE FUNCTION public.register_device_push_token(
  p_token text,
  p_timezone text,
  p_app_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token required';
  END IF;

  INSERT INTO public.device_push_tokens (
    user_id, token, platform, app_version, timezone, last_seen_at
  )
  VALUES (
    v_user,
    btrim(p_token),
    'ios',
    NULLIF(btrim(COALESCE(p_app_version, '')), ''),
    NULLIF(btrim(COALESCE(p_timezone, '')), ''),
    now()
  )
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    app_version = EXCLUDED.app_version,
    timezone = COALESCE(EXCLUDED.timezone, public.device_push_tokens.timezone),
    last_seen_at = now(),
    disabled_at = NULL;

  UPDATE public.profiles
  SET timezone = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), timezone)
  WHERE id = v_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_device_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN;
  END IF;
  UPDATE public.device_push_tokens
  SET last_seen_at = now()
  WHERE token = btrim(p_token) AND user_id = v_user AND disabled_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_device_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR p_token IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.device_push_tokens
  WHERE token = btrim(p_token) AND user_id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_push_token(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_device_push_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_device_push_token(text) TO authenticated;

DROP FUNCTION IF EXISTS public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION public.update_notification_settings(
  p_friend_requests BOOLEAN,
  p_friend_level_ups BOOLEAN,
  p_kudos BOOLEAN,
  p_announcements BOOLEAN,
  p_game_challenges BOOLEAN DEFAULT NULL,
  p_homework_reviews BOOLEAN DEFAULT NULL,
  p_lesson_scheduling BOOLEAN DEFAULT NULL,
  p_class_reminders BOOLEAN DEFAULT NULL,
  p_homework_due BOOLEAN DEFAULT NULL,
  p_community_sessions BOOLEAN DEFAULT NULL,
  p_forum_activity BOOLEAN DEFAULT NULL,
  p_streaks BOOLEAN DEFAULT NULL,
  p_weekly_recap BOOLEAN DEFAULT NULL
)
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

  INSERT INTO public.notification_settings (
    user_id,
    friend_requests,
    friend_level_ups,
    kudos,
    announcements,
    game_challenges,
    homework_reviews,
    lesson_scheduling,
    class_reminders,
    homework_due,
    community_sessions,
    forum_activity,
    streaks,
    weekly_recap,
    updated_at
  )
  VALUES (
    v_user,
    COALESCE(p_friend_requests, true),
    COALESCE(p_friend_level_ups, true),
    COALESCE(p_kudos, true),
    COALESCE(p_announcements, true),
    COALESCE(p_game_challenges, true),
    COALESCE(p_homework_reviews, true),
    COALESCE(p_lesson_scheduling, true),
    COALESCE(p_class_reminders, true),
    COALESCE(p_homework_due, true),
    COALESCE(p_community_sessions, true),
    COALESCE(p_forum_activity, true),
    COALESCE(p_streaks, true),
    COALESCE(p_weekly_recap, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    friend_requests = COALESCE(p_friend_requests, notification_settings.friend_requests),
    friend_level_ups = COALESCE(p_friend_level_ups, notification_settings.friend_level_ups),
    kudos = COALESCE(p_kudos, notification_settings.kudos),
    announcements = COALESCE(p_announcements, notification_settings.announcements),
    game_challenges = COALESCE(p_game_challenges, notification_settings.game_challenges),
    homework_reviews = COALESCE(p_homework_reviews, notification_settings.homework_reviews),
    lesson_scheduling = COALESCE(p_lesson_scheduling, notification_settings.lesson_scheduling),
    class_reminders = COALESCE(p_class_reminders, notification_settings.class_reminders),
    homework_due = COALESCE(p_homework_due, notification_settings.homework_due),
    community_sessions = COALESCE(p_community_sessions, notification_settings.community_sessions),
    forum_activity = COALESCE(p_forum_activity, notification_settings.forum_activity),
    streaks = COALESCE(p_streaks, notification_settings.streaks),
    weekly_recap = COALESCE(p_weekly_recap, notification_settings.weekly_recap),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_settings(
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_publish_announcement(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_publish_announcement(TEXT, TEXT, UUID[]);

CREATE OR REPLACE FUNCTION public.admin_publish_announcement(
  p_title TEXT,
  p_body TEXT,
  p_recipient_user_ids UUID[] DEFAULT NULL,
  p_send_push BOOLEAN DEFAULT false
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

  INSERT INTO public.announcements (title, body, created_by, send_push)
  VALUES (btrim(p_title), btrim(p_body), v_admin, COALESCE(p_send_push, false))
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

GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(TEXT, TEXT, UUID[], BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
