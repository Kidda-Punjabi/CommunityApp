-- =============================================================================
-- Kidda — Community forum (paid members + staff)
-- Run in Supabase SQL Editor after profile-roles.sql
--
-- Access: memberships.status = 'active' OR profile_roles in
--   (tutor, community_lead, master_admin)
-- Confirmed enums (via live schema):
--   subscription_status: active, canceled, past_due, incomplete, trialing, unpaid
--   app_role: member, tutor, community_lead, master_admin
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: forum guidelines agreement
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_agreed_forum_guidelines BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_agreed_forum_guidelines IS
  'User accepted community forum guidelines before first post.';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  body        TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  category    TEXT,
  status      TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'removed')),
  like_count  INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON public.forum_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_status_created ON public.forum_posts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.forum_posts (id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  status      TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'removed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post_id ON public.forum_replies (post_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author_id ON public.forum_replies (author_id);

CREATE TABLE IF NOT EXISTS public.forum_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.forum_posts (id) ON DELETE CASCADE,
  reply_id    UUID REFERENCES public.forum_replies (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT forum_likes_target_check CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL)
    OR (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_likes_user_post
  ON public.forum_likes (user_id, post_id)
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_likes_user_reply
  ON public.forum_likes (user_id, reply_id)
  WHERE reply_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_forum_likes_post_id ON public.forum_likes (post_id)
  WHERE post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.forum_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.forum_posts (id) ON DELETE SET NULL,
  reply_id    UUID REFERENCES public.forum_replies (id) ON DELETE SET NULL,
  reason      TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  status      TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT forum_reports_target_check CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL)
    OR (post_id IS NULL AND reply_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_forum_reports_status ON public.forum_reports (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.forum_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_posts_updated_at ON public.forum_posts;
CREATE TRIGGER trg_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_set_updated_at();

DROP TRIGGER IF EXISTS trg_forum_replies_updated_at ON public.forum_replies;
CREATE TRIGGER trg_forum_replies_updated_at
  BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_set_updated_at();

-- ---------------------------------------------------------------------------
-- like_count maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.forum_sync_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.post_id IS NOT NULL THEN
    UPDATE public.forum_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.post_id IS NOT NULL THEN
    UPDATE public.forum_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_forum_likes_post_count ON public.forum_likes;
CREATE TRIGGER trg_forum_likes_post_count
  AFTER INSERT OR DELETE ON public.forum_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_sync_post_like_count();

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_access_forum(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = p_user_id
        AND m.status = 'active'::public.subscription_status
    )
    OR public.user_has_any_staff_role(
      p_user_id,
      ARRAY[
        'tutor'::public.app_role,
        'community_lead'::public.app_role,
        'master_admin'::public.app_role
      ]
    );
$$;

CREATE OR REPLACE FUNCTION public.is_forum_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_any_staff_role(
    auth.uid(),
    ARRAY[
      'tutor'::public.app_role,
      'community_lead'::public.app_role,
      'master_admin'::public.app_role
    ]
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_forum(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_forum_moderator() TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

-- forum_posts
DROP POLICY IF EXISTS "Forum members read posts" ON public.forum_posts;
CREATE POLICY "Forum members read posts"
  ON public.forum_posts FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
    AND (
      status = 'visible'
      OR author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  );

DROP POLICY IF EXISTS "Forum members create posts" ON public.forum_posts;
CREATE POLICY "Forum members create posts"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_forum()
    AND author_id = auth.uid()
    AND status = 'visible'
  );

DROP POLICY IF EXISTS "Forum update posts" ON public.forum_posts;
CREATE POLICY "Forum update posts"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (
    public.user_can_access_forum()
    AND (
      author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  )
  WITH CHECK (
    public.user_can_access_forum()
    AND (
      author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  );

DROP POLICY IF EXISTS "Forum delete own posts" ON public.forum_posts;
CREATE POLICY "Forum delete own posts"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (
    public.user_can_access_forum()
    AND author_id = auth.uid()
  );

-- forum_replies
DROP POLICY IF EXISTS "Forum members read replies" ON public.forum_replies;
CREATE POLICY "Forum members read replies"
  ON public.forum_replies FOR SELECT TO authenticated
  USING (
    public.user_can_access_forum()
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
    public.user_can_access_forum()
    AND author_id = auth.uid()
    AND status = 'visible'
    AND EXISTS (
      SELECT 1
      FROM public.forum_posts p
      WHERE p.id = post_id
        AND p.status = 'visible'
    )
  );

DROP POLICY IF EXISTS "Forum update replies" ON public.forum_replies;
CREATE POLICY "Forum update replies"
  ON public.forum_replies FOR UPDATE TO authenticated
  USING (
    public.user_can_access_forum()
    AND (
      author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  )
  WITH CHECK (
    public.user_can_access_forum()
    AND (
      author_id = auth.uid()
      OR public.is_forum_moderator()
    )
  );

DROP POLICY IF EXISTS "Forum delete own replies" ON public.forum_replies;
CREATE POLICY "Forum delete own replies"
  ON public.forum_replies FOR DELETE TO authenticated
  USING (
    public.user_can_access_forum()
    AND author_id = auth.uid()
  );

-- forum_likes
DROP POLICY IF EXISTS "Forum members read likes" ON public.forum_likes;
CREATE POLICY "Forum members read likes"
  ON public.forum_likes FOR SELECT TO authenticated
  USING (public.user_can_access_forum());

DROP POLICY IF EXISTS "Forum members like content" ON public.forum_likes;
CREATE POLICY "Forum members like content"
  ON public.forum_likes FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_forum()
    AND user_id = auth.uid()
    AND (
      (
        post_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.forum_posts p
          WHERE p.id = post_id AND p.status = 'visible'
        )
      )
      OR (
        reply_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.forum_replies r
          WHERE r.id = reply_id AND r.status = 'visible'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Forum members unlike content" ON public.forum_likes;
CREATE POLICY "Forum members unlike content"
  ON public.forum_likes FOR DELETE TO authenticated
  USING (
    public.user_can_access_forum()
    AND user_id = auth.uid()
  );

-- forum_reports
DROP POLICY IF EXISTS "Forum members create reports" ON public.forum_reports;
CREATE POLICY "Forum members create reports"
  ON public.forum_reports FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_forum()
    AND reporter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Forum read own reports" ON public.forum_reports;
CREATE POLICY "Forum read own reports"
  ON public.forum_reports FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.is_forum_moderator()
  );

DROP POLICY IF EXISTS "Forum moderators update reports" ON public.forum_reports;
CREATE POLICY "Forum moderators update reports"
  ON public.forum_reports FOR UPDATE TO authenticated
  USING (public.is_forum_moderator())
  WITH CHECK (public.is_forum_moderator());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_replies TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.forum_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.forum_reports TO authenticated;

GRANT ALL ON public.forum_posts TO service_role;
GRANT ALL ON public.forum_replies TO service_role;
GRANT ALL ON public.forum_likes TO service_role;
GRANT ALL ON public.forum_reports TO service_role;

NOTIFY pgrst, 'reload schema';
