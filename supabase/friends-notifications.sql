-- =============================================================================
-- Kidda — Friends, friend requests, notifications, kudos, announcements
-- Run in Supabase SQL Editor after referrals.sql and learner-progression.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Notification preferences (one row per user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  friend_requests BOOLEAN NOT NULL DEFAULT true,
  friend_level_ups BOOLEAN NOT NULL DEFAULT true,
  kudos BOOLEAN NOT NULL DEFAULT true,
  announcements BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notification_settings IS
  'Per-user toggles for in-app notification types.';

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (from_user_id, to_user_id),
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_pending
  ON public.friend_requests (to_user_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_from
  ON public.friend_requests (from_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Friendships (stored both directions for simple queries)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  friend_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'request'
    CHECK (source IN ('request', 'referral')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id),
  CHECK (user_id <> friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user
  ON public.friendships (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'friend_request',
    'friend_request_accepted',
    'friend_level_up',
    'kudos',
    'announcement'
  )),
  actor_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Kudos on level-up notifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, from_user_id)
);

-- ---------------------------------------------------------------------------
-- Admin announcements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._ensure_notification_settings(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._add_friendship_pair(
  p_user_a UUID,
  p_user_b UUID,
  p_source TEXT DEFAULT 'request'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
    RETURN;
  END IF;

  INSERT INTO public.friendships (user_id, friend_user_id, source)
  VALUES (p_user_a, p_user_b, p_source)
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;

  INSERT INTO public.friendships (user_id, friend_user_id, source)
  VALUES (p_user_b, p_user_a, p_source)
  ON CONFLICT (user_id, friend_user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_actor_user_id UUID,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_settings public.notification_settings%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM public._ensure_notification_settings(p_user_id);
  SELECT * INTO v_settings FROM public.notification_settings WHERE user_id = p_user_id;

  IF p_type = 'friend_request' AND NOT COALESCE(v_settings.friend_requests, true) THEN
    RETURN NULL;
  ELSIF p_type = 'friend_level_up' AND NOT COALESCE(v_settings.friend_level_ups, true) THEN
    RETURN NULL;
  ELSIF p_type = 'kudos' AND NOT COALESCE(v_settings.kudos, true) THEN
    RETURN NULL;
  ELSIF p_type = 'announcement' AND NOT COALESCE(v_settings.announcements, true) THEN
    RETURN NULL;
  END IF;

  IF p_actor_user_id IS NOT NULL AND p_actor_user_id = p_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, type, actor_user_id, payload)
  VALUES (p_user_id, p_type, p_actor_user_id, COALESCE(p_payload, '{}'::JSONB))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Auto-friend on referral (extends referral attribution)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._insert_referral(
  p_referrer UUID,
  p_referred UUID,
  p_code TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_referrer IS NULL OR p_referred IS NULL OR p_referrer = p_referred THEN
    RETURN;
  END IF;

  INSERT INTO public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code_used,
    status
  )
  VALUES (p_referrer, p_referred, p_code, 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;

  PERFORM public._add_friendship_pair(p_referrer, p_referred, 'referral');
END;
$$;

-- ---------------------------------------------------------------------------
-- Friend request RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_friend_request(p_to_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
  v_request_id UUID;
  v_existing public.friend_requests%ROWTYPE;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_to_user_id IS NULL OR p_to_user_id = v_from THEN
    RAISE EXCEPTION 'Invalid friend target';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = v_from AND friend_user_id = p_to_user_id
  ) THEN
    RAISE EXCEPTION 'Already friends';
  END IF;

  SELECT * INTO v_existing
  FROM public.friend_requests
  WHERE (from_user_id = v_from AND to_user_id = p_to_user_id)
     OR (from_user_id = p_to_user_id AND to_user_id = v_from)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND v_existing.status = 'pending' THEN
    RAISE EXCEPTION 'Friend request already pending';
  END IF;

  IF FOUND AND v_existing.status = 'accepted' THEN
    RAISE EXCEPTION 'Already friends';
  END IF;

  INSERT INTO public.friend_requests (from_user_id, to_user_id, status)
  VALUES (v_from, p_to_user_id, 'pending')
  RETURNING id INTO v_request_id;

  PERFORM public._create_notification(
    p_to_user_id,
    'friend_request',
    v_from,
    jsonb_build_object('request_id', v_request_id)
  );

  RETURN jsonb_build_object('request_id', v_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request_by_code(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := lower(btrim(p_referral_code));
  v_target UUID;
BEGIN
  IF v_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT id INTO v_target
  FROM public.profiles
  WHERE lower(referral_code) = v_code
  LIMIT 1;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'No user found with that invite code';
  END IF;

  RETURN public.send_friend_request(v_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(
  p_request_id UUID,
  p_accept BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_req public.friend_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.friend_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF v_req.to_user_id <> v_user THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already handled';
  END IF;

  UPDATE public.friend_requests
  SET
    status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    responded_at = now()
  WHERE id = p_request_id;

  IF p_accept THEN
    PERFORM public._add_friendship_pair(v_req.from_user_id, v_req.to_user_id, 'request');

    PERFORM public._create_notification(
      v_req.from_user_id,
      'friend_request_accepted',
      v_user,
      jsonb_build_object('request_id', p_request_id)
    );
  END IF;

  RETURN jsonb_build_object('accepted', p_accept);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_user_id UUID)
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

  DELETE FROM public.friendships
  WHERE (user_id = v_user AND friend_user_id = p_friend_user_id)
     OR (user_id = p_friend_user_id AND friend_user_id = v_user);
END;
$$;

-- ---------------------------------------------------------------------------
-- Notify friends when learner levels up
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_friends_on_level_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_friend UUID;
  v_notification_id UUID;
BEGIN
  IF NEW.learner_level IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.learner_level IS NOT DISTINCT FROM NEW.learner_level THEN
    RETURN NEW;
  END IF;

  IF NEW.learner_level <= COALESCE(OLD.learner_level, 0) THEN
    RETURN NEW;
  END IF;

  FOR v_friend IN
    SELECT friend_user_id
    FROM public.friendships
    WHERE user_id = NEW.id
  LOOP
    v_notification_id := public._create_notification(
      v_friend,
      'friend_level_up',
      NEW.id,
      jsonb_build_object(
        'new_level', NEW.learner_level,
        'previous_level', OLD.learner_level
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_notify_friends_level_up ON public.profiles;
CREATE TRIGGER trg_profiles_notify_friends_level_up
  AFTER UPDATE OF learner_level ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friends_on_level_up();

-- ---------------------------------------------------------------------------
-- Kudos
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_kudos(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from UUID := auth.uid();
  v_notif public.notifications%ROWTYPE;
  v_level INTEGER;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_notif
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  IF v_notif.user_id <> v_from THEN
    RAISE EXCEPTION 'Can only send kudos from your own level-up notifications';
  END IF;

  IF v_notif.type <> 'friend_level_up' THEN
    RAISE EXCEPTION 'Invalid notification type for kudos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_kudos
    WHERE notification_id = p_notification_id AND from_user_id = v_from
  ) THEN
    RAISE EXCEPTION 'Kudos already sent';
  END IF;

  INSERT INTO public.notification_kudos (notification_id, from_user_id)
  VALUES (p_notification_id, v_from);

  v_level := (v_notif.payload->>'new_level')::INTEGER;

  PERFORM public._create_notification(
    v_notif.actor_user_id,
    'kudos',
    v_from,
    jsonb_build_object(
      'level', v_level,
      'source_notification_id', p_notification_id
    )
  );

  RETURN jsonb_build_object('sent', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Notification read + settings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
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

  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id AND user_id = v_user AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = v_user AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notification_settings(
  p_friend_requests BOOLEAN,
  p_friend_level_ups BOOLEAN,
  p_kudos BOOLEAN,
  p_announcements BOOLEAN
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
    user_id, friend_requests, friend_level_ups, kudos, announcements, updated_at
  )
  VALUES (
    v_user,
    COALESCE(p_friend_requests, true),
    COALESCE(p_friend_level_ups, true),
    COALESCE(p_kudos, true),
    COALESCE(p_announcements, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    friend_requests = COALESCE(p_friend_requests, notification_settings.friend_requests),
    friend_level_ups = COALESCE(p_friend_level_ups, notification_settings.friend_level_ups),
    kudos = COALESCE(p_kudos, notification_settings.kudos),
    announcements = COALESCE(p_announcements, notification_settings.announcements),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_my_notification_settings()
RETURNS public.notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.notification_settings%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public._ensure_notification_settings(v_user);

  SELECT * INTO v_row FROM public.notification_settings WHERE user_id = v_user;
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin: publish announcement to all users
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_publish_announcement(
  p_title TEXT,
  p_body TEXT
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
BEGIN
  IF v_admin IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' OR p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Title and body required';
  END IF;

  INSERT INTO public.announcements (title, body, created_by)
  VALUES (btrim(p_title), btrim(p_body), v_admin)
  RETURNING id INTO v_id;

  FOR v_user IN SELECT id FROM public.profiles LOOP
    PERFORM public._create_notification(
      v_user,
      'announcement',
      v_admin,
      jsonb_build_object('announcement_id', v_id, 'title', btrim(p_title), 'body', btrim(p_body))
    );
  END LOOP;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lookup user by invite code (for add friend UI)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_user_by_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT := lower(btrim(p_code));
  v_target public.profiles%ROWTYPE;
  v_status TEXT := 'none';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE lower(referral_code) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_target.id = v_user THEN
    RAISE EXCEPTION 'That is your own invite code';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id = v_user AND friend_user_id = v_target.id
  ) THEN
    v_status := 'friends';
  ELSIF EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'pending'
      AND ((from_user_id = v_user AND to_user_id = v_target.id)
        OR (from_user_id = v_target.id AND to_user_id = v_user))
  ) THEN
    v_status := 'pending';
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_target.id,
    'full_name', v_target.full_name,
    'preferred_name', v_target.preferred_name,
    'avatar_url', v_target.avatar_url,
    'referral_code', v_target.referral_code,
    'relationship', v_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_kudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification settings" ON public.notification_settings;
CREATE POLICY "Users manage own notification settings"
  ON public.notification_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read friend requests they participate in" ON public.friend_requests;
CREATE POLICY "Users read friend requests they participate in"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own friendships" ON public.friendships;
CREATE POLICY "Users read own friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read kudos on own notifications" ON public.notification_kudos;
CREATE POLICY "Users read kudos on own notifications"
  ON public.notification_kudos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.id = notification_id AND n.user_id = auth.uid()
    )
    OR from_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated read announcements" ON public.announcements;
CREATE POLICY "Authenticated read announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.notification_settings TO authenticated;
GRANT SELECT ON public.friend_requests TO authenticated;
GRANT SELECT ON public.friendships TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.notification_kudos TO authenticated;
GRANT SELECT ON public.announcements TO authenticated;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_kudos(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_settings(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_notification_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_user_by_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
