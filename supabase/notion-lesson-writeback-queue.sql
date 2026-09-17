-- =============================================================================
-- Kidda — Queue attendance/homework Notion Lessons Log writeback
-- Run against project pztubczhqkzcwtkstpgi.
-- Does not alter cohort_lesson_homework or existing homework_submissions triggers.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notion_lesson_writeback_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('attendance', 'homework')),
  student_id uuid REFERENCES public.profiles (id) ON DELETE CASCADE,
  kid_profile_id uuid REFERENCES public.kid_profiles (id) ON DELETE CASCADE,
  cohort_id uuid REFERENCES public.cohorts (id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  lesson_date date,
  source_row_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT notion_lesson_writeback_queue_actor_check
    CHECK ((student_id IS NOT NULL) <> (kid_profile_id IS NOT NULL))
);

COMMENT ON TABLE public.notion_lesson_writeback_queue IS
  'Outbound Notion Lessons Log writeback for attendance (attended=true) and homework_submissions inserts. Append-only Attendees/Homework relations.';
COMMENT ON COLUMN public.notion_lesson_writeback_queue.student_id IS
  'Adult actor. Null for kids (XOR with kid_profile_id), matching cohort_lesson_attendance / homework_submissions.';
COMMENT ON COLUMN public.notion_lesson_writeback_queue.lesson_date IS
  'Resolved at enqueue when uniquely known; processor skips rather than guessing if still null.';

-- Unique so re-marking the same lesson does not duplicate queue rows.
-- Split to match the live XOR actor model: student_id is null for kids.
CREATE UNIQUE INDEX IF NOT EXISTS notion_lesson_writeback_queue_adult_key
  ON public.notion_lesson_writeback_queue (kind, student_id, lesson_id)
  WHERE student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notion_lesson_writeback_queue_kid_key
  ON public.notion_lesson_writeback_queue (kind, kid_profile_id, lesson_id)
  WHERE kid_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notion_lesson_writeback_queue_due
  ON public.notion_lesson_writeback_queue (created_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.notion_lesson_writeback_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notion_lesson_writeback_queue FROM anon, authenticated;
GRANT SELECT ON public.notion_lesson_writeback_queue TO authenticated;
GRANT ALL ON public.notion_lesson_writeback_queue TO service_role;

DROP POLICY IF EXISTS "Staff read notion lesson writeback queue"
  ON public.notion_lesson_writeback_queue;
CREATE POLICY "Staff read notion lesson writeback queue"
  ON public.notion_lesson_writeback_queue FOR SELECT TO authenticated
  USING (public.is_community_lead());

-- ---------------------------------------------------------------------------
-- Resolve helpers (null rather than pick when ambiguous)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notion_writeback_resolve_lesson_date(
  p_cohort_id uuid,
  p_lesson_id uuid
) RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_dates date[];
BEGIN
  IF p_cohort_id IS NULL OR p_lesson_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ARRAY_AGG(DISTINCT e.lesson_date) INTO v_dates
  FROM public.cohort_lesson_log_entries e
  WHERE e.cohort_id = p_cohort_id
    AND e.lesson_id = p_lesson_id
    AND e.lesson_date IS NOT NULL;

  IF v_dates IS NOT NULL AND cardinality(v_dates) = 1 THEN
    RETURN v_dates[1];
  END IF;

  IF v_dates IS NOT NULL AND cardinality(v_dates) > 1 THEN
    RETURN NULL;
  END IF;

  SELECT ARRAY_AGG(DISTINCT (tss.starts_at AT TIME ZONE 'Europe/London')::date)
    INTO v_dates
  FROM public.tutor_scheduled_sessions tss
  JOIN public.lessons l ON l.id = p_lesson_id
  WHERE tss.cohort_id = p_cohort_id
    AND tss.week_number = l.lesson_number
    AND tss.status = 'scheduled'
    AND tss.match_method IS DISTINCT FROM 'unmatched'
    AND tss.match_method IS DISTINCT FROM 'title_name';

  IF v_dates IS NOT NULL AND cardinality(v_dates) = 1 THEN
    RETURN v_dates[1];
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.notion_writeback_resolve_homework_cohort_id(
  p_student_id uuid,
  p_kid_profile_id uuid,
  p_lesson_id uuid
) RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF p_lesson_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ARRAY_AGG(DISTINCT ce.cohort_id) INTO v_ids
  FROM public.course_enrollments ce
  JOIN public.lessons l ON l.id = p_lesson_id AND l.course_id = ce.course_id
  WHERE ce.cohort_id IS NOT NULL
    AND (
      (p_student_id IS NOT NULL AND ce.user_id = p_student_id)
      OR (p_kid_profile_id IS NOT NULL AND ce.kid_profile_id = p_kid_profile_id)
    );

  IF v_ids IS NOT NULL AND cardinality(v_ids) = 1 THEN
    RETURN v_ids[1];
  END IF;

  IF v_ids IS NOT NULL AND cardinality(v_ids) > 1 THEN
    RETURN NULL;
  END IF;

  SELECT ARRAY_AGG(DISTINCT cm.cohort_id) INTO v_ids
  FROM public.cohort_members cm
  JOIN public.cohorts c ON c.id = cm.cohort_id
  JOIN public.lessons l ON l.id = p_lesson_id AND l.course_id = c.course_id
  WHERE cm.left_at IS NULL
    AND (
      (p_student_id IS NOT NULL AND cm.user_id = p_student_id)
      OR (p_kid_profile_id IS NOT NULL AND cm.kid_profile_id = p_kid_profile_id)
    );

  IF v_ids IS NOT NULL AND cardinality(v_ids) = 1 THEN
    RETURN v_ids[1];
  END IF;

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue triggers (never raise into the source insert/update)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_notion_lesson_writeback_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.attended IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.attended IS NOT DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.kid_profile_id IS NOT NULL THEN
      INSERT INTO public.notion_lesson_writeback_queue (
        kind, student_id, kid_profile_id, cohort_id, lesson_id, lesson_date, source_row_id
      )
      VALUES (
        'attendance',
        NULL,
        NEW.kid_profile_id,
        NEW.cohort_id,
        NEW.lesson_id,
        public.notion_writeback_resolve_lesson_date(NEW.cohort_id, NEW.lesson_id),
        NEW.id
      )
      ON CONFLICT (kind, kid_profile_id, lesson_id) WHERE kid_profile_id IS NOT NULL
      DO NOTHING;
    ELSE
      INSERT INTO public.notion_lesson_writeback_queue (
        kind, student_id, kid_profile_id, cohort_id, lesson_id, lesson_date, source_row_id
      )
      VALUES (
        'attendance',
        NEW.student_id,
        NULL,
        NEW.cohort_id,
        NEW.lesson_id,
        public.notion_writeback_resolve_lesson_date(NEW.cohort_id, NEW.lesson_id),
        NEW.id
      )
      ON CONFLICT (kind, student_id, lesson_id) WHERE student_id IS NOT NULL
      DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notion lesson writeback attendance enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_notion_lesson_writeback_homework()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort_id uuid;
BEGIN
  BEGIN
    v_cohort_id := public.notion_writeback_resolve_homework_cohort_id(
      NEW.student_id,
      NEW.kid_profile_id,
      NEW.lesson_id
    );

    IF NEW.kid_profile_id IS NOT NULL THEN
      INSERT INTO public.notion_lesson_writeback_queue (
        kind, student_id, kid_profile_id, cohort_id, lesson_id, lesson_date, source_row_id
      )
      VALUES (
        'homework',
        NULL,
        NEW.kid_profile_id,
        v_cohort_id,
        NEW.lesson_id,
        public.notion_writeback_resolve_lesson_date(v_cohort_id, NEW.lesson_id),
        NEW.id
      )
      ON CONFLICT (kind, kid_profile_id, lesson_id) WHERE kid_profile_id IS NOT NULL
      DO NOTHING;
    ELSE
      INSERT INTO public.notion_lesson_writeback_queue (
        kind, student_id, kid_profile_id, cohort_id, lesson_id, lesson_date, source_row_id
      )
      VALUES (
        'homework',
        NEW.student_id,
        NULL,
        v_cohort_id,
        NEW.lesson_id,
        public.notion_writeback_resolve_lesson_date(v_cohort_id, NEW.lesson_id),
        NEW.id
      )
      ON CONFLICT (kind, student_id, lesson_id) WHERE student_id IS NOT NULL
      DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notion lesson writeback homework enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notion_writeback_attendance ON public.cohort_lesson_attendance;
CREATE TRIGGER trg_notion_writeback_attendance
  AFTER INSERT OR UPDATE ON public.cohort_lesson_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notion_lesson_writeback_attendance();

DROP TRIGGER IF EXISTS trg_notion_writeback_homework ON public.homework_submissions;
CREATE TRIGGER trg_notion_writeback_homework
  AFTER INSERT ON public.homework_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notion_lesson_writeback_homework();

REVOKE ALL ON FUNCTION public.notion_writeback_resolve_lesson_date(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notion_writeback_resolve_homework_cohort_id(uuid, uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.enqueue_notion_lesson_writeback_attendance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notion_lesson_writeback_homework() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notion_lesson_writeback_attendance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notion_lesson_writeback_attendance() TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_notion_lesson_writeback_homework() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notion_lesson_writeback_homework() TO service_role;

NOTIFY pgrst, 'reload schema';
