-- =============================================================================
-- Kidda — Catch-up lesson player (segments, beats, progress, images bucket)
-- Run in Supabase SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- lesson_segments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_segments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id             UUID NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  segment_number        INTEGER NOT NULL CHECK (segment_number > 0),
  sort_order            INTEGER NOT NULL,
  title                 TEXT NOT NULL,
  teaching_image_path   TEXT,
  teaching_visual_type  TEXT,
  teaching_visual_config JSONB,
  activity_type         TEXT NOT NULL DEFAULT 'none'
    CHECK (activity_type IN ('none', 'quiz', 'flashcard_set', 'game', 'homework', 'external_link')),
  activity_ref_id       UUID,
  activity_instructions TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_segments_lesson_number_unique UNIQUE (lesson_id, segment_number)
);

CREATE INDEX IF NOT EXISTS idx_lesson_segments_lesson_sort
  ON public.lesson_segments (lesson_id, sort_order);

COMMENT ON TABLE public.lesson_segments IS
  'Ordered catch-up segments for a lesson — teaching beats + optional end-of-segment activity.';

-- ---------------------------------------------------------------------------
-- lesson_segment_beats
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_segment_beats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id          UUID NOT NULL REFERENCES public.lesson_segments (id) ON DELETE CASCADE,
  beat_number         INTEGER NOT NULL CHECK (beat_number > 0),
  beat_type           TEXT NOT NULL
    CHECK (beat_type IN ('narration', 'phrase_reference')),
  script_text         TEXT,
  source_content_type TEXT,
  source_content_id   UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_segment_beats_segment_beat_unique UNIQUE (segment_id, beat_number),
  CONSTRAINT lesson_segment_beats_narration_script CHECK (
    beat_type <> 'narration' OR (script_text IS NOT NULL AND char_length(trim(script_text)) > 0)
  ),
  CONSTRAINT lesson_segment_beats_phrase_source CHECK (
    beat_type <> 'phrase_reference'
    OR (
      source_content_type IS NOT NULL
      AND char_length(trim(source_content_type)) > 0
      AND source_content_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_lesson_segment_beats_segment
  ON public.lesson_segment_beats (segment_id, beat_number);

COMMENT ON TABLE public.lesson_segment_beats IS
  'Narration beats use audio_assets (lesson_segment_beat). Phrase beats reference existing content audio.';

-- ---------------------------------------------------------------------------
-- lesson_segment_progress (lesson_progress is per-lesson, not per-segment)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_segment_progress (
  user_id      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  segment_id   UUID NOT NULL REFERENCES public.lesson_segments (id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, segment_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_segment_progress_user
  ON public.lesson_segment_progress (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lesson_segments_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_segments_updated_at ON public.lesson_segments;
CREATE TRIGGER trg_lesson_segments_updated_at
  BEFORE UPDATE ON public.lesson_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.lesson_segments_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — gate reads via is_lesson_content_unlocked (same as lesson content)
-- ---------------------------------------------------------------------------

ALTER TABLE public.lesson_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_segment_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_segment_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read lesson segments when lesson unlocked" ON public.lesson_segments;
CREATE POLICY "Read lesson segments when lesson unlocked"
  ON public.lesson_segments FOR SELECT TO authenticated
  USING (public.is_lesson_content_unlocked(auth.uid(), lesson_id));

DROP POLICY IF EXISTS "Staff manage lesson segments" ON public.lesson_segments;
CREATE POLICY "Staff manage lesson segments"
  ON public.lesson_segments FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_master_admin())
  WITH CHECK (public.is_staff() OR public.is_master_admin());

DROP POLICY IF EXISTS "Read beats when segment lesson unlocked" ON public.lesson_segment_beats;
CREATE POLICY "Read beats when segment lesson unlocked"
  ON public.lesson_segment_beats FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_segments ls
      WHERE ls.id = segment_id
        AND public.is_lesson_content_unlocked(auth.uid(), ls.lesson_id)
    )
  );

DROP POLICY IF EXISTS "Staff manage lesson segment beats" ON public.lesson_segment_beats;
CREATE POLICY "Staff manage lesson segment beats"
  ON public.lesson_segment_beats FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_master_admin())
  WITH CHECK (public.is_staff() OR public.is_master_admin());

DROP POLICY IF EXISTS "Users manage own segment progress" ON public.lesson_segment_progress;
CREATE POLICY "Users manage own segment progress"
  ON public.lesson_segment_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.lesson_segments TO authenticated;
GRANT SELECT ON public.lesson_segment_beats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_segment_progress TO authenticated;
GRANT ALL ON public.lesson_segments TO service_role;
GRANT ALL ON public.lesson_segment_beats TO service_role;
GRANT ALL ON public.lesson_segment_progress TO service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket for segment slide images
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-segment-images',
  'lesson-segment-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read lesson segment images" ON storage.objects;
CREATE POLICY "Public read lesson segment images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'lesson-segment-images');

DROP POLICY IF EXISTS "Staff upload lesson segment images" ON storage.objects;
CREATE POLICY "Staff upload lesson segment images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-segment-images'
    AND (public.is_staff() OR public.is_master_admin())
  );

DROP POLICY IF EXISTS "Staff update lesson segment images" ON storage.objects;
CREATE POLICY "Staff update lesson segment images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lesson-segment-images'
    AND (public.is_staff() OR public.is_master_admin())
  );

DROP POLICY IF EXISTS "Staff delete lesson segment images" ON storage.objects;
CREATE POLICY "Staff delete lesson segment images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'lesson-segment-images'
    AND (public.is_staff() OR public.is_master_admin())
  );

NOTIFY pgrst, 'reload schema';
