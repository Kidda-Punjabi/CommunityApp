-- =============================================================================
-- Kidda — Homework due reminder dedupe log
-- Run after homework-submissions.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.homework_due_reminder_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  lesson_id   UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id, lesson_id)
);

COMMENT ON TABLE public.homework_due_reminder_logs IS
  'Tracks homework reminders already sent for an upcoming lesson so cron does not spam duplicates.';

CREATE INDEX IF NOT EXISTS idx_homework_due_reminder_logs_student
  ON public.homework_due_reminder_logs (student_id, sent_at DESC);

ALTER TABLE public.homework_due_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own homework due reminders" ON public.homework_due_reminder_logs;
CREATE POLICY "Students read own homework due reminders"
  ON public.homework_due_reminder_logs FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_master_admin());

GRANT SELECT ON public.homework_due_reminder_logs TO authenticated;
GRANT ALL ON public.homework_due_reminder_logs TO service_role;

NOTIFY pgrst, 'reload schema';
