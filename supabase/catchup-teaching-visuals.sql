-- =============================================================================
-- Kidda — Catch-up segment teaching visuals (code-built, Lucide + CSS)
-- Run after supabase/catchup-lesson-segments.sql
-- Replaces slide-image workflow; teaching_image_path is deprecated (kept).
-- =============================================================================

ALTER TABLE public.lesson_segments
  ADD COLUMN IF NOT EXISTS teaching_visual_type TEXT,
  ADD COLUMN IF NOT EXISTS teaching_visual_config JSONB;

COMMENT ON COLUMN public.lesson_segments.teaching_image_path IS
  'Deprecated — slide JPEG path in lesson-segment-images. Use teaching_visual_type + teaching_visual_config.';

COMMENT ON COLUMN public.lesson_segments.teaching_visual_type IS
  'icon_hero | zone_diagram | phrase_showcase | activity_scene | recap_banner | quiz_banner';

COMMENT ON COLUMN public.lesson_segments.teaching_visual_config IS
  'Template-specific JSON props for the in-app teaching visual component.';
