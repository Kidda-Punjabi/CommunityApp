-- =============================================================================
-- Forum: post edited_at, deleted status, threaded replies (parent_reply_id)
-- Run in Supabase SQL Editor after supabase/forum.sql
-- =============================================================================

ALTER TABLE public.forum_posts
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN public.forum_posts.edited_at IS
  'Set only when the author edits title/body — not moderation or other updates.';

ALTER TABLE public.forum_posts DROP CONSTRAINT IF EXISTS forum_posts_status_check;
ALTER TABLE public.forum_posts
  ADD CONSTRAINT forum_posts_status_check
  CHECK (status IN ('visible', 'hidden', 'removed', 'deleted'));

COMMENT ON COLUMN public.forum_posts.status IS
  'visible = public; hidden/removed = moderation; deleted = author or master_admin soft-delete.';

ALTER TABLE public.forum_replies
  ADD COLUMN IF NOT EXISTS parent_reply_id UUID
  REFERENCES public.forum_replies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forum_replies_parent_reply_id
  ON public.forum_replies (parent_reply_id)
  WHERE parent_reply_id IS NOT NULL;

COMMENT ON COLUMN public.forum_replies.parent_reply_id IS
  'When set, this reply is nested under parent_reply_id (same post_id). ON DELETE SET NULL keeps children visible if parent is hard-deleted.';

-- Replies to a reply must belong to the same post and target a visible parent.
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
    AND (
      parent_reply_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.forum_replies pr
        WHERE pr.id = parent_reply_id
          AND pr.post_id = post_id
          AND pr.status = 'visible'
      )
    )
  );

NOTIFY pgrst, 'reload schema';
