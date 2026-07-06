export const SOUND_NAMES = [
  "correct",
  "incorrect",
  "button_tap",
  "game_complete",
  "level_up",
  "xp_milestone",
  "sticker_earned",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

export type SoundSettings = {
  soundEnabled: boolean;
  soundVolume: number;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  soundEnabled: true,
  soundVolume: 0.7,
};

export const SOUND_SETTINGS_CHANGED_EVENT = "kidda:sound-settings-changed";
export const LEVEL_UP_SOUND_EVENT = "kidda:level-up";

export function notifyLevelUpSound() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEVEL_UP_SOUND_EVENT));
}

export function dispatchSoundSettingsChanged(settings: SoundSettings) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SOUND_SETTINGS_CHANGED_EVENT, { detail: settings })
  );
}
