-- Public bucket for Life in the UK lesson_sentences TTS clips.
-- Usually created by scripts/generate-lesson-sentence-audio.ts via ensureBucket.
-- Run manually only if the script cannot create buckets.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-sentence-audio',
  'lesson-sentence-audio',
  true,
  10485760,
  ARRAY['audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
