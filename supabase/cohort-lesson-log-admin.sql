-- =============================================================================
-- Kidda — Lesson Log admin columns (status, reviewed, Notion sync tracking)
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notion_sync_error text,
  ADD COLUMN IF NOT EXISTS notion_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_lesson_log_entries_status_check'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_status_check
      CHECK (
        status IS NULL
        OR status IN ('Scheduled', 'Completed', 'Cancelled')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_lesson_log_entries_notion_sync_status_check'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_notion_sync_status_check
      CHECK (notion_sync_status IN ('pending', 'synced', 'error'));
  END IF;
END $$;

-- Allow unlinked rows (neither cohort nor instance) so admin can monitor them.
ALTER TABLE public.cohort_lesson_log_entries
  DROP CONSTRAINT IF EXISTS cohort_lesson_log_entries_target_check;

COMMENT ON COLUMN public.cohort_lesson_log_entries.status IS
  'Notion Lessons Log Status: Scheduled / Completed / Cancelled.';
COMMENT ON COLUMN public.cohort_lesson_log_entries.reviewed IS
  'Notion Lessons Log Reviewed checkbox.';
COMMENT ON COLUMN public.cohort_lesson_log_entries.notion_sync_status IS
  'pending | synced | error — powers admin Lesson Log sync badges.';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_status
  ON public.cohort_lesson_log_entries (status);

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_sync_status
  ON public.cohort_lesson_log_entries (notion_sync_status)
  WHERE notion_sync_status <> 'synced';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_unlinked
  ON public.cohort_lesson_log_entries (lesson_date DESC)
  WHERE cohort_id IS NULL AND package_instance_id IS NULL;

NOTIFY pgrst, 'reload schema';
