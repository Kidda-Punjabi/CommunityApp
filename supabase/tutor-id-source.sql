-- Manual admin tutor assignment must not be overwritten by Notion pull.
-- tutor_id_source = 'manual' → pull skips tutor_id; 'notion' → pull may update.

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS tutor_id_source text NOT NULL DEFAULT 'notion'
    CHECK (tutor_id_source IN ('notion', 'manual'));

ALTER TABLE public.package_instances
  ADD COLUMN IF NOT EXISTS tutor_id_source text NOT NULL DEFAULT 'notion'
    CHECK (tutor_id_source IN ('notion', 'manual'));

COMMENT ON COLUMN public.cohorts.tutor_id_source IS
  'notion = last tutor came from Notion pull; manual = admin override (pull skips tutor_id).';

COMMENT ON COLUMN public.package_instances.tutor_id_source IS
  'notion = last tutor came from Notion pull; manual = admin override (pull skips tutor_id).';
