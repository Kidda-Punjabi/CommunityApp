"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { XP_EARNED_EVENT } from "@/lib/points/notify-points-earned";
import { playSynthesizedSound, warmUpAudioContext } from "@/lib/audio/synthesize-sound";
import {
  DEFAULT_SOUND_SETTINGS,
  dispatchSoundSettingsChanged,
  LEVEL_UP_SOUND_EVENT,
  SOUND_SETTINGS_CHANGED_EVENT,
  type SoundName,
  type SoundSettings,
} from "@/lib/audio/sound-types";

type AudioManagerContextValue = {
  soundEnabled: boolean;
  soundVolume: number;
  playSound: (name: SoundName) => void;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setSoundVolume: (volume: number) => Promise<void>;
};

const AudioManagerContext = createContext<AudioManagerContextValue | null>(null);

async function persistSoundSettings(settings: SoundSettings) {
  await fetch("/api/profile/sound-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      soundEnabled: settings.soundEnabled,
      soundVolume: settings.soundVolume,
    }),
  });
}

export function AudioManagerProvider({
  children,
  initialSettings = DEFAULT_SOUND_SETTINGS,
}: {
  children: React.ReactNode;
  initialSettings?: SoundSettings;
}) {
  const [settings, setSettings] = useState<SoundSettings>(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const playSound = useCallback((name: SoundName) => {
    const current = settingsRef.current;
    if (!current.soundEnabled) return;
    warmUpAudioContext();
    playSynthesizedSound(name, current.soundVolume);
  }, []);

  const applySettings = useCallback(async (next: SoundSettings) => {
    setSettings(next);
    dispatchSoundSettingsChanged(next);
    await persistSoundSettings(next);
  }, []);

  const setSoundEnabled = useCallback(
    async (enabled: boolean) => {
      const next = { ...settingsRef.current, soundEnabled: enabled };
      await applySettings(next);
      if (enabled) {
        warmUpAudioContext();
        playSynthesizedSound("button_tap", next.soundVolume);
      }
    },
    [applySettings]
  );

  const setSoundVolume = useCallback(
    async (volume: number) => {
      const clamped = Math.min(1, Math.max(0, volume));
      await applySettings({ ...settingsRef.current, soundVolume: clamped });
    },
    [applySettings]
  );

  useEffect(() => {
    function handleSettingsChanged(event: Event) {
      const detail = (event as CustomEvent<SoundSettings>).detail;
      if (!detail) return;
      setSettings(detail);
    }

    window.addEventListener(SOUND_SETTINGS_CHANGED_EVENT, handleSettingsChanged);
    return () => {
      window.removeEventListener(SOUND_SETTINGS_CHANGED_EVENT, handleSettingsChanged);
    };
  }, []);

  useEffect(() => {
    function handleXpEarned() {
      playSound("xp_milestone");
    }

    function handleLevelUp() {
      playSound("level_up");
    }

    window.addEventListener(XP_EARNED_EVENT, handleXpEarned);
    window.addEventListener(LEVEL_UP_SOUND_EVENT, handleLevelUp);
    return () => {
      window.removeEventListener(XP_EARNED_EVENT, handleXpEarned);
      window.removeEventListener(LEVEL_UP_SOUND_EVENT, handleLevelUp);
    };
  }, [playSound]);

  const value = useMemo(
    () => ({
      soundEnabled: settings.soundEnabled,
      soundVolume: settings.soundVolume,
      playSound,
      setSoundEnabled,
      setSoundVolume,
    }),
    [settings.soundEnabled, settings.soundVolume, playSound, setSoundEnabled, setSoundVolume]
  );

  return (
    <AudioManagerContext.Provider value={value}>{children}</AudioManagerContext.Provider>
  );
}

export function useAudioManager(): AudioManagerContextValue {
  const context = useContext(AudioManagerContext);
  if (!context) {
    return {
      soundEnabled: DEFAULT_SOUND_SETTINGS.soundEnabled,
      soundVolume: DEFAULT_SOUND_SETTINGS.soundVolume,
      playSound: () => undefined,
      setSoundEnabled: async () => undefined,
      setSoundVolume: async () => undefined,
    };
  }
  return context;
}
