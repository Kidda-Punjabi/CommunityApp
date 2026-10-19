-- Advance notice before the nightly sweep deletes leftover personal files.
-- Run in Supabase SQL Editor (project pztubczhqkzcwtkstpgi).

CREATE TABLE IF NOT EXISTS public.data_deletion_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  subject_label text,
  delete_on date,
  notice_14_sent_at timestamptz,
  notice_3_sent_at timestamptz,
  deleted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_notices_open
  ON public.data_deletion_notices (delete_on)
  WHERE deleted_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE public.data_deletion_notices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.data_deletion_notices FROM anon, authenticated;
GRANT SELECT ON public.data_deletion_notices TO authenticated;
GRANT ALL ON public.data_deletion_notices TO service_role;

DROP POLICY IF EXISTS data_deletion_notices_admin_read ON public.data_deletion_notices;
CREATE POLICY data_deletion_notices_admin_read
  ON public.data_deletion_notices
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin());
