-- Tutor voice-note feedback on homework reviews.
-- Files stay in the private homework-recordings bucket under feedback/<submission_id>/.
-- After a review is saved, only reviewed_by or an admin can change the audio columns.

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS tutor_feedback_audio_path text,
  ADD COLUMN IF NOT EXISTS tutor_feedback_audio_mime text,
  ADD COLUMN IF NOT EXISTS tutor_feedback_audio_duration_seconds integer;

ALTER TABLE public.homework_submissions
  DROP CONSTRAINT IF EXISTS homework_submissions_tutor_feedback_audio_duration_check;

ALTER TABLE public.homework_submissions
  ADD CONSTRAINT homework_submissions_tutor_feedback_audio_duration_check
  CHECK (
    tutor_feedback_audio_duration_seconds IS NULL
    OR (
      tutor_feedback_audio_duration_seconds >= 0
      AND tutor_feedback_audio_duration_seconds <= 120
    )
  );

COMMENT ON COLUMN public.homework_submissions.tutor_feedback_audio_path IS
  'Private homework-recordings path for the tutor voice note, under feedback/<submission_id>/.';
COMMENT ON COLUMN public.homework_submissions.tutor_feedback_audio_mime IS
  'MIME type of the tutor voice note, as produced by the browser recorder.';
COMMENT ON COLUMN public.homework_submissions.tutor_feedback_audio_duration_seconds IS
  'Length of the tutor voice note in seconds. Maximum 120.';

CREATE INDEX IF NOT EXISTS idx_homework_submissions_tutor_feedback_audio
  ON public.homework_submissions (tutor_feedback_audio_path)
  WHERE tutor_feedback_audio_path IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Later edits: audio columns only, and only by the reviewing tutor or an admin
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_homework_submission_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF OLD.status = 'reviewed' THEN
    IF NOT (
      public.is_master_admin()
      OR OLD.reviewed_by = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Reviewed homework submissions cannot be modified.';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.kid_profile_id IS DISTINCT FROM OLD.kid_profile_id
       OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
       OR NEW.submission_type IS DISTINCT FROM OLD.submission_type
       OR NEW.text_answers IS DISTINCT FROM OLD.text_answers
       OR NEW.is_practice IS DISTINCT FROM OLD.is_practice
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.tutor_comment IS DISTINCT FROM OLD.tutor_comment
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Reviewed homework submissions cannot be modified.';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.student_id THEN
    RAISE EXCEPTION 'Students cannot update homework after submission.';
  END IF;

  IF TG_OP = 'UPDATE' AND (public.is_tutor() OR public.is_master_admin()) THEN
    IF NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.kid_profile_id IS DISTINCT FROM OLD.kid_profile_id
       OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.duration_seconds IS DISTINCT FROM OLD.duration_seconds
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.submission_type IS DISTINCT FROM OLD.submission_type
       OR NEW.text_answers IS DISTINCT FROM OLD.text_answers
       OR NEW.is_practice IS DISTINCT FROM OLD.is_practice THEN
      RAISE EXCEPTION 'Tutors may only update review fields on homework submissions.';
    END IF;

    IF NEW.status <> 'reviewed' THEN
      RAISE EXCEPTION 'Tutor review must set status to reviewed.';
    END IF;

    IF NEW.approved IS NULL THEN
      RAISE EXCEPTION 'approved must be set when marking homework as reviewed.';
    END IF;

    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Reviewing tutor edits feedback audio" ON public.homework_submissions;
CREATE POLICY "Reviewing tutor edits feedback audio"
  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (
    status = 'reviewed'
    AND (
      public.is_master_admin()
      OR reviewed_by = auth.uid()
    )
  )
  WITH CHECK (
    status = 'reviewed'
    AND (
      public.is_master_admin()
      OR reviewed_by = auth.uid()
    )
  );

-- The reviewing tutor can still read the row after they are no longer the
-- assigned teacher, which an UPDATE policy also requires.
DROP POLICY IF EXISTS "Tutors read student homework" ON public.homework_submissions;
CREATE POLICY "Tutors read student homework"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    public.is_master_admin()
    OR reviewed_by = auth.uid()
    OR public.tutor_teaches_student_for_lesson(auth.uid(), student_id, lesson_id)
    OR public.tutor_teaches_kid_for_lesson(auth.uid(), kid_profile_id, lesson_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: feedback/ prefix only
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_path_uuid(p_name text, p_part integer)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  v text;
BEGIN
  v := split_part(p_name, '/', p_part);
  IF v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v::uuid;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.homework_feedback_submission_id(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) = 'feedback'
      THEN public.storage_path_uuid(p_name, 2)
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_homework_feedback_audio(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.homework_submissions hs
      WHERE hs.id = p_submission_id
        AND (
          public.is_master_admin()
          OR hs.reviewed_by = auth.uid()
          OR (
            hs.status = 'pending_review'
            AND hs.reviewed_by IS NULL
            AND (
              public.tutor_teaches_student_for_lesson(auth.uid(), hs.student_id, hs.lesson_id)
              OR public.tutor_teaches_kid_for_lesson(auth.uid(), hs.kid_profile_id, hs.lesson_id)
            )
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_homework_feedback_audio(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_submission_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.homework_submissions hs
      WHERE hs.id = p_submission_id
        AND (
          public.is_master_admin()
          OR hs.reviewed_by = auth.uid()
          OR hs.student_id = auth.uid()
          OR public.parent_owns_kid_profile(hs.kid_profile_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.storage_path_uuid(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.homework_feedback_submission_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_homework_feedback_audio(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_homework_feedback_audio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_uuid(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.homework_feedback_submission_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_homework_feedback_audio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_homework_feedback_audio(uuid) TO authenticated;

DROP POLICY IF EXISTS "Read homework recordings" ON storage.objects;
CREATE POLICY "Read homework recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-recordings'
    AND public.homework_feedback_submission_id(name) IS NULL
    AND (
      split_part(name, '/', 2) = auth.uid()::text
      OR public.is_master_admin()
      OR (
        public.is_tutor()
        AND public.tutor_teaches_student_for_lesson(
          auth.uid(),
          public.storage_path_uuid(name, 2),
          public.storage_path_uuid(name, 1)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Tutors write homework feedback audio" ON storage.objects;
CREATE POLICY "Tutors write homework feedback audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-recordings'
    AND public.can_write_homework_feedback_audio(public.homework_feedback_submission_id(name))
  );

DROP POLICY IF EXISTS "Reviewing tutor deletes homework feedback audio" ON storage.objects;
CREATE POLICY "Reviewing tutor deletes homework feedback audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-recordings'
    AND public.can_write_homework_feedback_audio(public.homework_feedback_submission_id(name))
  );

DROP POLICY IF EXISTS "Read homework feedback audio" ON storage.objects;
CREATE POLICY "Read homework feedback audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-recordings'
    AND public.can_read_homework_feedback_audio(public.homework_feedback_submission_id(name))
  );

NOTIFY pgrst, 'reload schema';
