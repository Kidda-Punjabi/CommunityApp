-- =============================================================================
-- Kidda — Cohort / package Lessons Log (Notion mirror)
-- Session-level log entries synced with Notion "Lessons Log" database.
-- Distinct from cohort_lesson_attendance (per-student present/absent).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cohort_lesson_log_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT NOT NULL,
  cohort_id             UUID REFERENCES public.cohorts (id) ON DELETE CASCADE,
  package_instance_id   UUID REFERENCES public.package_instances (id) ON DELETE CASCADE,
  lesson_title          TEXT,
  lesson_date           DATE NOT NULL,
  recording_url         TEXT,
  slides_url            TEXT,
  flashcards_url        TEXT,
  notes                 TEXT,
  notion_tutor_user_id  TEXT,
  logged_by             UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  source                TEXT NOT NULL DEFAULT 'notion'
    CHECK (source IN ('notion', 'app')),
  notion_last_edited_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cohort_lesson_log_entries_notion_page_id_key UNIQUE (notion_page_id),
  CONSTRAINT cohort_lesson_log_entries_target_check CHECK (
    cohort_id IS NOT NULL OR package_instance_id IS NOT NULL
  )
);

COMMENT ON TABLE public.cohort_lesson_log_entries IS
  'Session-level Lessons Log entries mirrored from Notion (and created from tutor app). One row per live session that happened. Count of rows = weeks/lessons completed.';

COMMENT ON COLUMN public.cohort_lesson_log_entries.source IS
  'app = created from tutor dashboard (pushed to Notion); notion = pulled from Notion.';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_cohort_date
  ON public.cohort_lesson_log_entries (cohort_id, lesson_date ASC)
  WHERE cohort_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_instance_date
  ON public.cohort_lesson_log_entries (package_instance_id, lesson_date ASC)
  WHERE package_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_notion_edited
  ON public.cohort_lesson_log_entries (notion_last_edited_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.touch_cohort_lesson_log_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohort_lesson_log_entries_updated_at
  ON public.cohort_lesson_log_entries;
CREATE TRIGGER trg_cohort_lesson_log_entries_updated_at
  BEFORE UPDATE ON public.cohort_lesson_log_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_cohort_lesson_log_entries_updated_at();

ALTER TABLE public.cohort_lesson_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read lesson log entries"
  ON public.cohort_lesson_log_entries;
CREATE POLICY "Admins read lesson log entries"
  ON public.cohort_lesson_log_entries FOR SELECT TO authenticated
  USING (public.is_master_admin());

DROP POLICY IF EXISTS "Tutors read own cohort lesson logs"
  ON public.cohort_lesson_log_entries;
CREATE POLICY "Tutors read own cohort lesson logs"
  ON public.cohort_lesson_log_entries FOR SELECT TO authenticated
  USING (
    (
      cohort_id IS NOT NULL
      AND public.tutor_can_manage_cohort(cohort_id)
    )
    OR (
      package_instance_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.package_instances pi
        WHERE pi.id = package_instance_id
          AND (pi.tutor_id = auth.uid() OR public.is_master_admin())
      )
    )
  );

DROP POLICY IF EXISTS "Students read own cohort lesson logs"
  ON public.cohort_lesson_log_entries;
CREATE POLICY "Students read own cohort lesson logs"
  ON public.cohort_lesson_log_entries FOR SELECT TO authenticated
  USING (
    cohort_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.cohort_members cm
      WHERE cm.cohort_id = cohort_lesson_log_entries.cohort_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- Writes go through service role / server actions (Notion sync + tutor log).
GRANT SELECT ON public.cohort_lesson_log_entries TO authenticated;

NOTIFY pgrst, 'reload schema';
