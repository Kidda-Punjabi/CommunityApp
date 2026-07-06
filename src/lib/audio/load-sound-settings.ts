import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from "./sound-types";

export async function loadSoundSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<SoundSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select("sound_enabled, sound_volume")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SOUND_SETTINGS;
  }

  const row = data as {
    sound_enabled?: boolean | null;
    sound_volume?: number | null;
  };

  return {
    soundEnabled: row.sound_enabled ?? DEFAULT_SOUND_SETTINGS.soundEnabled,
    soundVolume:
      typeof row.sound_volume === "number"
        ? Math.min(1, Math.max(0, row.sound_volume))
        : DEFAULT_SOUND_SETTINGS.soundVolume,
  };
}
