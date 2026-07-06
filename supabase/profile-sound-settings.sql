-- =============================================================================
-- Kidda — Profile sound effect preferences
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_volume NUMERIC NOT NULL DEFAULT 0.7
    CHECK (sound_volume >= 0 AND sound_volume <= 1);

COMMENT ON COLUMN public.profiles.sound_enabled IS
  'Global mute for UI sound effects (games, XP toasts, Kids Mode stickers).';

COMMENT ON COLUMN public.profiles.sound_volume IS
  'UI sound effect volume from 0 to 1.';

NOTIFY pgrst, 'reload schema';
