-- =============================================================================
-- Kidda — Tutor session package links + lesson logs
-- Run after tutor-google-calendar.sql and student-packages.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_session_package_links (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  tutor_id           UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_package_id UUID NOT NULL REFERENCES public.student_packages (id) ON DELETE CASCADE,
  link_scope         TEXT NOT NULL DEFAULT 'event' CHECK (link_scope IN ('event', 'series')),
  linked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by          UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  UNIQUE (session_id)
);

COMMENT ON TABLE public.tutor_session_package_links IS
  'Links each synced tutor calendar session to a student package. Series links are expanded into per-session rows.';

CREATE INDEX IF NOT EXISTS idx_tutor_session_package_links_tutor
  ON public.tutor_session_package_links (tutor_id, linked_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_session_package_links_package
  ON public.tutor_session_package_links (student_package_id);

CREATE TABLE IF NOT EXISTS public.tutor_session_logs (
  session_id          UUID PRIMARY KEY REFERENCES public.tutor_scheduled_sessions (id) ON DELETE CASCADE,
  tutor_id            UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  completed           BOOLEAN NOT NULL DEFAULT false,
  attendance_marked   BOOLEAN NOT NULL DEFAULT false,
  attendance_status   TEXT CHECK (attendance_status IN ('present', 'absent_notified', 'absent_unnotified')),
  homework_marked     BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  completed_at        TIMESTAMPTZ,
  attendance_marked_at TIMESTAMPTZ,
  homework_marked_at  TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.tutor_session_logs IS
  'Tutor lesson log per scheduled session (completion, attendance, homework).';
COMMENT ON COLUMN public.tutor_session_logs.attendance_status IS
  'Detailed attendance status. NULL means attendance has not been logged yet.';

ALTER TABLE public.tutor_session_logs
  ADD COLUMN IF NOT EXISTS attendance_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutor_session_logs_attendance_status_check'
      AND conrelid = 'public.tutor_session_logs'::regclass
  ) THEN
    ALTER TABLE public.tutor_session_logs
      ADD CONSTRAINT tutor_session_logs_attendance_status_check
      CHECK (attendance_status IN ('present', 'absent_notified', 'absent_unnotified'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_tutor_session_log_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_session_logs_updated_at ON public.tutor_session_logs;
CREATE TRIGGER trg_tutor_session_logs_updated_at
  BEFORE UPDATE ON public.tutor_session_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_tutor_session_log_updated_at();

ALTER TABLE public.tutor_session_package_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors manage own session package links" ON public.tutor_session_package_links;
CREATE POLICY "Tutors manage own session package links"
  ON public.tutor_session_package_links FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read own session package links" ON public.tutor_session_package_links;
CREATE POLICY "Students read own session package links"
  ON public.tutor_session_package_links FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.student_packages sp
      WHERE sp.id = tutor_session_package_links.student_package_id
        AND sp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tutors manage own session logs" ON public.tutor_session_logs;
CREATE POLICY "Tutors manage own session logs"
  ON public.tutor_session_logs FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read own session logs" ON public.tutor_session_logs;
CREATE POLICY "Students read own session logs"
  ON public.tutor_session_logs FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tutor_scheduled_sessions s
      WHERE s.id = tutor_session_logs.session_id
        AND s.student_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_session_package_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_session_logs TO authenticated;
GRANT ALL ON public.tutor_session_package_links TO service_role;
GRANT ALL ON public.tutor_session_logs TO service_role;

NOTIFY pgrst, 'reload schema';
