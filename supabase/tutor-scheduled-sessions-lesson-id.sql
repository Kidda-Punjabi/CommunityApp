-- Explicit curriculum lesson for a group cohort calendar session.
-- week_number stays as the display value copied from lessons.lesson_number when lesson_id is set.
-- lesson_assignment_status = needs_assignment means a lesson sync ran and found no lessons row.
-- Both null means the session has not been through lesson assignment.

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.lessons (id) ON DELETE SET NULL;

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS lesson_assignment_status TEXT;

ALTER TABLE public.tutor_scheduled_sessions
  DROP CONSTRAINT IF EXISTS tutor_scheduled_sessions_lesson_assignment_status_check;

ALTER TABLE public.tutor_scheduled_sessions
  ADD CONSTRAINT tutor_scheduled_sessions_lesson_assignment_status_check
  CHECK (
    (
      lesson_id IS NULL
      AND lesson_assignment_status IS NULL
    )
    OR (
      lesson_id IS NULL
      AND lesson_assignment_status = 'needs_assignment'
    )
    OR (
      lesson_id IS NOT NULL
      AND lesson_assignment_status IS NULL
    )
  );

COMMENT ON COLUMN public.tutor_scheduled_sessions.lesson_id IS
  'Curriculum lesson (lessons.id) this cohort session represents. Calendar time updates must not clear it.';

COMMENT ON COLUMN public.tutor_scheduled_sessions.lesson_assignment_status IS
  'needs_assignment when lesson sync ran and no lessons row could be attached. NULL with lesson_id set means assigned. NULL with lesson_id null means not yet processed.';

CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_lesson_id
  ON public.tutor_scheduled_sessions (lesson_id)
  WHERE lesson_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
