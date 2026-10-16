-- Forum moderation, polls, and App Store user-generated-content rules.
-- Existing posts, replies, and likes are left in place.

ALTER TABLE public.forum_posts DROP CONSTRAINT IF EXISTS forum_posts_status_check;
ALTER TABLE public.forum_posts
  ADD CONSTRAINT forum_posts_status_check
  CHECK (status = ANY (ARRAY['visible','hidden','removed','deleted','hidden_pending_review']));

ALTER TABLE public.forum_replies DROP CONSTRAINT IF EXISTS forum_replies_status_check;
ALTER TABLE public.forum_replies
  ADD CONSTRAINT forum_replies_status_check
  CHECK (status = ANY (ARRAY['visible','hidden','removed','deleted','hidden_pending_review']));

ALTER TABLE public.forum_reports
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text;

ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_reason_check;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_reason_check
  CHECK (reason = ANY (ARRAY['spam','harassment','hate_speech','inappropriate','other']));

ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_status_check;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_status_check
  CHECK (status = ANY (ARRAY['open','dismissed','actioned']));

ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_details_check;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_details_check
  CHECK (details IS NULL OR char_length(details) <= 500);

ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_other_details_check;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_other_details_check
  CHECK (reason <> 'other' OR char_length(btrim(coalesce(details, ''))) > 0);

ALTER TABLE public.forum_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_reporter_id_fkey;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.forum_reports DROP CONSTRAINT IF EXISTS forum_reports_reviewed_by_fkey;
ALTER TABLE public.forum_reports
  ADD CONSTRAINT forum_reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_reporter_post_uidx
  ON public.forum_reports (reporter_id, post_id)
  WHERE post_id IS NOT NULL AND reporter_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS forum_reports_reporter_reply_uidx
  ON public.forum_reports (reporter_id, reply_id)
  WHERE reply_id IS NOT NULL AND reporter_id IS NOT NULL;

-- Settings and rules
CREATE TABLE IF NOT EXISTS public.forum_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.forum_settings (key, value)
VALUES ('rules_version', '1')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.current_forum_rules_version()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value::integer FROM public.forum_settings WHERE key = 'rules_version'), 1);
$$;

CREATE TABLE IF NOT EXISTS public.forum_rules_acceptances (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rules_version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rules_version)
);

CREATE OR REPLACE FUNCTION public.forum_has_accepted_rules(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forum_rules_acceptances a
    WHERE a.user_id = p_user_id
      AND a.rules_version = public.current_forum_rules_version()
  );
$$;

-- Blocks
CREATE TABLE IF NOT EXISTS public.forum_user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT forum_user_blocks_pair_key UNIQUE (blocker_id, blocked_id)
);

-- Suspensions
CREATE TABLE IF NOT EXISTS public.forum_user_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reason text NOT NULL,
  suspended_until timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz
);

CREATE INDEX IF NOT EXISTS forum_user_suspensions_user_idx
  ON public.forum_user_suspensions (user_id, lifted_at, suspended_until);

CREATE OR REPLACE FUNCTION public.forum_user_is_suspended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forum_user_suspensions s
    WHERE s.user_id = p_user_id
      AND s.lifted_at IS NULL
      AND (s.suspended_until IS NULL OR s.suspended_until > now())
  );
$$;

-- Blocked terms
CREATE TABLE IF NOT EXISTS public.forum_blocked_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT forum_blocked_terms_term_key UNIQUE (term)
);

INSERT INTO public.forum_blocked_terms (term)
VALUES
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'),
  ('shit'), ('bullshit'), ('bitch'), ('bastard'),
  ('asshole'), ('dick'), ('cock'), ('pussy'), ('cunt'),
  ('whore'), ('slut'), ('nigger'), ('nigga'), ('faggot'), ('fag'),
  ('retard'), ('retarded'),
  ('bhenchod'), ('behenchod'), ('madarchod'), ('madharchod'),
  ('chutiya'), ('chutia'), ('gaandu'), ('gandu'),
  ('bhosdike'), ('bhosdi'), ('harami'), ('randi'), ('chodu')
ON CONFLICT (term) DO NOTHING;

CREATE OR REPLACE FUNCTION public.forum_text_has_blocked_term(p_text text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  term text;
  pattern text;
  chars text[];
  i int;
  letter text;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN false;
  END IF;

  FOR term IN SELECT lower(t.term) FROM public.forum_blocked_terms t LOOP
    chars := regexp_split_to_array(term, '');
    pattern := '(^|[^a-z])';
    FOR i IN 1..coalesce(array_length(chars, 1), 0) LOOP
      letter := chars[i];
      IF letter ~ '^[a-z]$' THEN
        IF i > 1 THEN
          pattern := pattern || '[^a-z]*';
        END IF;
        pattern := pattern || letter || '+';
      END IF;
    END LOOP;
    pattern := pattern || '($|[^a-z])';
    IF lower(p_text) ~ pattern THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.forum_reject_blocked_language()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  haystack text;
BEGIN
  IF TG_TABLE_NAME = 'forum_posts' THEN
    IF TG_OP = 'UPDATE'
      AND NEW.title IS NOT DISTINCT FROM OLD.title
      AND NEW.body IS NOT DISTINCT FROM OLD.body THEN
      RETURN NEW;
    END IF;
    haystack := coalesce(NEW.title, '') || ' ' || coalesce(NEW.body, '');
  ELSIF TG_TABLE_NAME = 'forum_replies' THEN
    IF TG_OP = 'UPDATE' AND NEW.body IS NOT DISTINCT FROM OLD.body THEN
      RETURN NEW;
    END IF;
    haystack := coalesce(NEW.body, '');
  ELSIF TG_TABLE_NAME = 'forum_polls' THEN
    IF TG_OP = 'UPDATE' AND NEW.question IS NOT DISTINCT FROM OLD.question THEN
      RETURN NEW;
    END IF;
    haystack := coalesce(NEW.question, '');
  ELSE
    IF TG_OP = 'UPDATE' AND NEW.label IS NOT DISTINCT FROM OLD.label THEN
      RETURN NEW;
    END IF;
    haystack := coalesce(NEW.label, '');
  END IF;

  IF public.forum_text_has_blocked_term(haystack) THEN
    RAISE EXCEPTION 'FORUM_LANGUAGE_NOT_ALLOWED'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_posts_language ON public.forum_posts;
CREATE TRIGGER trg_forum_posts_language
  BEFORE INSERT OR UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_reject_blocked_language();

DROP TRIGGER IF EXISTS trg_forum_replies_language ON public.forum_replies;
CREATE TRIGGER trg_forum_replies_language
  BEFORE INSERT OR UPDATE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_reject_blocked_language();

-- Reports: not your own content, then auto-hide at 3 open reports
CREATE OR REPLACE FUNCTION public.forum_reject_self_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author uuid;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT author_id INTO author FROM public.forum_posts WHERE id = NEW.post_id;
  ELSIF NEW.reply_id IS NOT NULL THEN
    SELECT author_id INTO author FROM public.forum_replies WHERE id = NEW.reply_id;
  END IF;
  IF author IS NOT NULL AND author = NEW.reporter_id THEN
    RAISE EXCEPTION 'FORUM_CANNOT_REPORT_OWN' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_reports_not_own ON public.forum_reports;
CREATE TRIGGER trg_forum_reports_not_own
  BEFORE INSERT ON public.forum_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_reject_self_report();

CREATE OR REPLACE FUNCTION public.forum_auto_hide_reported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_count integer;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT count(DISTINCT reporter_id) INTO open_count
    FROM public.forum_reports
    WHERE post_id = NEW.post_id AND status = 'open' AND reporter_id IS NOT NULL;
    IF open_count >= 3 THEN
      UPDATE public.forum_posts
      SET status = 'hidden_pending_review'
      WHERE id = NEW.post_id AND status = 'visible';
    END IF;
  ELSIF NEW.reply_id IS NOT NULL THEN
    SELECT count(DISTINCT reporter_id) INTO open_count
    FROM public.forum_reports
    WHERE reply_id = NEW.reply_id AND status = 'open' AND reporter_id IS NOT NULL;
    IF open_count >= 3 THEN
      UPDATE public.forum_replies
      SET status = 'hidden_pending_review'
      WHERE id = NEW.reply_id AND status = 'visible';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_reports_auto_hide ON public.forum_reports;
CREATE TRIGGER trg_forum_reports_auto_hide
  AFTER INSERT ON public.forum_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_auto_hide_reported();

-- Polls
CREATE TABLE IF NOT EXISTS public.forum_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.forum_posts (id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(btrim(question)) > 0),
  closes_at timestamptz,
  allow_multiple boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.forum_polls (id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) > 0),
  position integer NOT NULL
);

CREATE INDEX IF NOT EXISTS forum_poll_options_poll_idx
  ON public.forum_poll_options (poll_id, position);

CREATE TABLE IF NOT EXISTS public.forum_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.forum_polls (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.forum_poll_options (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_poll_votes_user_option_key UNIQUE (poll_id, option_id, user_id)
);

DROP TRIGGER IF EXISTS trg_forum_poll_options_language ON public.forum_poll_options;
CREATE TRIGGER trg_forum_poll_options_language
  BEFORE INSERT OR UPDATE ON public.forum_poll_options
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_reject_blocked_language();

DROP TRIGGER IF EXISTS trg_forum_polls_language ON public.forum_polls;
CREATE TRIGGER trg_forum_polls_language
  BEFORE INSERT OR UPDATE ON public.forum_polls
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_reject_blocked_language();

CREATE OR REPLACE FUNCTION public.forum_guard_poll_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poll public.forum_polls%ROWTYPE;
BEGIN
  SELECT * INTO poll FROM public.forum_polls WHERE id = NEW.poll_id;
  IF poll.id IS NULL THEN
    RAISE EXCEPTION 'FORUM_POLL_MISSING' USING ERRCODE = 'P0001';
  END IF;
  IF poll.closes_at IS NOT NULL AND poll.closes_at <= now() THEN
    RAISE EXCEPTION 'FORUM_POLL_CLOSED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.forum_poll_options o
    WHERE o.id = NEW.option_id AND o.poll_id = NEW.poll_id
  ) THEN
    RAISE EXCEPTION 'FORUM_POLL_OPTION' USING ERRCODE = 'P0001';
  END IF;
  IF NOT poll.allow_multiple THEN
    DELETE FROM public.forum_poll_votes
    WHERE poll_id = NEW.poll_id AND user_id = NEW.user_id AND option_id <> NEW.option_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_poll_votes_guard ON public.forum_poll_votes;
CREATE TRIGGER trg_forum_poll_votes_guard
  BEFORE INSERT OR UPDATE ON public.forum_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_guard_poll_vote();

-- Kid sessions cannot use the forum. Suspension still allows reading.
CREATE OR REPLACE FUNCTION public.user_can_access_forum(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.kid_session_context k
      JOIN public.kid_profiles kp ON kp.id = k.active_kid_profile_id
      WHERE k.user_id = p_user_id
        AND k.active_kid_profile_id IS NOT NULL
        AND kp.parent_user_id = p_user_id
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.user_id = p_user_id
          AND m.status = 'active'::public.subscription_status
      )
      OR public.user_has_any_staff_role(
        p_user_id,
        ARRAY['tutor'::public.app_role, 'community_lead'::public.app_role, 'master_admin'::public.app_role]
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.forum_can_contribute(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_access_forum(p_user_id)
    AND public.forum_has_accepted_rules(p_user_id)
    AND NOT public.forum_user_is_suspended(p_user_id);
$$;

-- RLS
ALTER TABLE public.forum_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_rules_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_blocked_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Forum members read settings" ON public.forum_settings;
CREATE POLICY "Forum members read settings"
  ON public.forum_settings FOR SELECT TO authenticated
  USING (public.user_can_access_forum());

DROP POLICY IF EXISTS "Forum read own rules" ON public.forum_rules_acceptances;
CREATE POLICY "Forum read own rules"
  ON public.forum_rules_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum update own rules" ON public.forum_rules_acceptances;
CREATE POLICY "Forum update own rules"
  ON public.forum_rules_acceptances FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND rules_version = public.current_forum_rules_version());

DROP POLICY IF EXISTS "Forum accept rules" ON public.forum_rules_acceptances;
CREATE POLICY "Forum accept rules"
  ON public.forum_rules_acceptances FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_access_forum()
    AND rules_version = public.current_forum_rules_version()
  );

DROP POLICY IF EXISTS "Forum read own blocks" ON public.forum_user_blocks;
CREATE POLICY "Forum read own blocks"
  ON public.forum_user_blocks FOR SELECT TO authenticated
  USING (blocker_id = auth.uid() OR public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum create blocks" ON public.forum_user_blocks;
CREATE POLICY "Forum create blocks"
  ON public.forum_user_blocks FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND public.user_can_access_forum());

DROP POLICY IF EXISTS "Forum delete own blocks" ON public.forum_user_blocks;
CREATE POLICY "Forum delete own blocks"
  ON public.forum_user_blocks FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "Forum read suspensions" ON public.forum_user_suspensions;
CREATE POLICY "Forum read suspensions"
  ON public.forum_user_suspensions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum moderators write suspensions" ON public.forum_user_suspensions;
CREATE POLICY "Forum moderators write suspensions"
  ON public.forum_user_suspensions FOR INSERT TO authenticated
  WITH CHECK (public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum moderators update suspensions" ON public.forum_user_suspensions;
CREATE POLICY "Forum moderators update suspensions"
  ON public.forum_user_suspensions FOR UPDATE TO authenticated
  USING (public.is_forum_moderator())
  WITH CHECK (public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum admins manage blocked terms" ON public.forum_blocked_terms;
CREATE POLICY "Forum admins manage blocked terms"
  ON public.forum_blocked_terms FOR ALL TO authenticated
  USING (public.is_forum_moderator())
  WITH CHECK (public.is_forum_moderator());

DROP POLICY IF EXISTS "Forum members create posts" ON public.forum_posts;
CREATE POLICY "Forum members create posts"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    public.forum_can_contribute()
    AND author_id = auth.uid()
    AND status = 'visible'
  );

DROP POLICY IF EXISTS "Forum members read posts" ON public.forum_posts;
CREATE POLICY "Forum members read posts"
  ON public.forum_posts FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND (
      public.is_forum_moderator()
      OR NOT EXISTS (
        SELECT 1 FROM public.forum_user_blocks b
        WHERE b.blocker_id = auth.uid() AND b.blocked_id = forum_posts.author_id
      )
    )
    AND (
      public.is_forum_moderator()
      OR NOT EXISTS (
        SELECT 1 FROM public.forum_reports r
        WHERE r.reporter_id = auth.uid() AND r.post_id = forum_posts.id
      )
    )
    AND (
      status = 'visible'
      OR author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  );

DROP POLICY IF EXISTS "Forum members create replies" ON public.forum_replies;
CREATE POLICY "Forum members create replies"
  ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (
    public.forum_can_contribute()
    AND author_id = auth.uid()
    AND status = 'visible'
    AND EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = forum_replies.post_id AND p.status = 'visible'
    )
    AND (
      parent_reply_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.forum_replies parent
        WHERE parent.id = forum_replies.parent_reply_id
          AND parent.post_id = forum_replies.post_id
          AND parent.status = 'visible'
      )
    )
  );

DROP POLICY IF EXISTS "Forum members read replies" ON public.forum_replies;
CREATE POLICY "Forum members read replies"
  ON public.forum_replies FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND (
      public.is_forum_moderator()
      OR NOT EXISTS (
        SELECT 1 FROM public.forum_user_blocks b
        WHERE b.blocker_id = auth.uid() AND b.blocked_id = forum_replies.author_id
      )
    )
    AND (
      public.is_forum_moderator()
      OR NOT EXISTS (
        SELECT 1 FROM public.forum_reports r
        WHERE r.reporter_id = auth.uid() AND r.reply_id = forum_replies.id
      )
    )
    AND (
      status = 'visible'
      OR author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  );

DROP POLICY IF EXISTS "Forum members like content" ON public.forum_likes;
CREATE POLICY "Forum members like content"
  ON public.forum_likes FOR INSERT TO authenticated
  WITH CHECK (
    public.forum_can_contribute()
    AND user_id = auth.uid()
    AND (
      (
        post_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.forum_posts p
          WHERE p.id = forum_likes.post_id AND p.status = 'visible'
        )
      )
      OR (
        reply_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.forum_replies r
          WHERE r.id = forum_likes.reply_id AND r.status = 'visible'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Forum read polls" ON public.forum_polls;
CREATE POLICY "Forum read polls"
  ON public.forum_polls FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = forum_polls.post_id
    )
  );

DROP POLICY IF EXISTS "Forum create polls" ON public.forum_polls;
CREATE POLICY "Forum create polls"
  ON public.forum_polls FOR INSERT TO authenticated
  WITH CHECK (
    public.forum_can_contribute()
    AND EXISTS (
      SELECT 1 FROM public.forum_posts p
      WHERE p.id = post_id AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Forum read poll options" ON public.forum_poll_options;
CREATE POLICY "Forum read poll options"
  ON public.forum_poll_options FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND EXISTS (SELECT 1 FROM public.forum_polls poll WHERE poll.id = poll_id)
  );

DROP POLICY IF EXISTS "Forum create poll options" ON public.forum_poll_options;
CREATE POLICY "Forum create poll options"
  ON public.forum_poll_options FOR INSERT TO authenticated
  WITH CHECK (
    public.forum_can_contribute()
    AND EXISTS (
      SELECT 1
      FROM public.forum_polls poll
      JOIN public.forum_posts p ON p.id = poll.post_id
      WHERE poll.id = poll_id AND p.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Forum read poll votes" ON public.forum_poll_votes;
CREATE POLICY "Forum read poll votes"
  ON public.forum_poll_votes FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND (user_id = auth.uid() OR public.is_forum_moderator())
  );

DROP POLICY IF EXISTS "Forum cast poll votes" ON public.forum_poll_votes;
CREATE POLICY "Forum cast poll votes"
  ON public.forum_poll_votes FOR INSERT TO authenticated
  WITH CHECK (public.forum_can_contribute() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Forum change poll votes" ON public.forum_poll_votes;
CREATE POLICY "Forum change poll votes"
  ON public.forum_poll_votes FOR UPDATE TO authenticated
  USING (public.forum_can_contribute() AND user_id = auth.uid())
  WITH CHECK (public.forum_can_contribute() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Forum remove poll votes" ON public.forum_poll_votes;
CREATE POLICY "Forum remove poll votes"
  ON public.forum_poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.user_can_access_forum());

GRANT SELECT ON public.forum_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.forum_rules_acceptances TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.forum_user_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.forum_user_suspensions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_blocked_terms TO authenticated;
GRANT SELECT, INSERT ON public.forum_polls TO authenticated;
GRANT SELECT, INSERT ON public.forum_poll_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_poll_votes TO authenticated;
GRANT ALL ON public.forum_settings TO service_role;
GRANT ALL ON public.forum_rules_acceptances TO service_role;
GRANT ALL ON public.forum_user_blocks TO service_role;
GRANT ALL ON public.forum_user_suspensions TO service_role;
GRANT ALL ON public.forum_blocked_terms TO service_role;
GRANT ALL ON public.forum_polls TO service_role;
GRANT ALL ON public.forum_poll_options TO service_role;
GRANT ALL ON public.forum_poll_votes TO service_role;

CREATE OR REPLACE FUNCTION public.forum_poll_results(p_poll_id uuid)
RETURNS TABLE (option_id uuid, votes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, count(v.id)
  FROM public.forum_poll_options o
  LEFT JOIN public.forum_poll_votes v ON v.option_id = o.id
  WHERE o.poll_id = p_poll_id
    AND public.user_can_access_forum(auth.uid())
  GROUP BY o.id;
$$;

REVOKE ALL ON FUNCTION public.forum_poll_results(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_poll_results(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
