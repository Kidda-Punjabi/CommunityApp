-- =============================================================================
-- Kidda — public_quiz_attempts: Notion Test Scores sync tracking
-- Matches feedback_submissions notion_page_id / sync status columns.
-- =============================================================================

ALTER TABLE public.public_quiz_attempts
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notion_sync_error text,
  ADD COLUMN IF NOT EXISTS notion_synced_at timestamptz;

ALTER TABLE public.public_quiz_attempts
  DROP CONSTRAINT IF EXISTS public_quiz_attempts_notion_sync_status_check;

ALTER TABLE public.public_quiz_attempts
  ADD CONSTRAINT public_quiz_attempts_notion_sync_status_check
  CHECK (notion_sync_status IN ('pending', 'synced', 'failed'));

CREATE INDEX IF NOT EXISTS idx_public_quiz_attempts_notion_sync_status
  ON public.public_quiz_attempts (notion_sync_status)
  WHERE notion_sync_status <> 'synced';

COMMENT ON COLUMN public.public_quiz_attempts.notion_page_id IS
  'Notion Test Scores page id after a successful sync.';
COMMENT ON COLUMN public.public_quiz_attempts.notion_sync_status IS
  'pending until Notion create succeeds (synced) or fails (failed).';
COMMENT ON COLUMN public.public_quiz_attempts.notion_sync_error IS
  'Last Notion API error; cleared on successful sync.';
COMMENT ON COLUMN public.public_quiz_attempts.notion_synced_at IS
  'When the Test Scores Notion page was created.';

NOTIFY pgrst, 'reload schema';
