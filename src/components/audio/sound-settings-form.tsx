"use client";

import { useAudioManager } from "@/lib/audio/audio-manager";
import { BackLink } from "@/components/navigation/back-link";
import { ui } from "@/lib/ui/styles";
import type { SoundSettings } from "@/lib/audio/sound-types";

type SoundSettingsFormProps = {
  initialSettings: SoundSettings;
};

export function SoundSettingsForm({ initialSettings }: SoundSettingsFormProps) {
  const { soundEnabled, soundVolume, setSoundEnabled, setSoundVolume } = useAudioManager();

  const enabled = soundEnabled;
  const volume = soundVolume;

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </BackLink>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Sound</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Control game sounds, XP chimes, and Kids Mode celebrations. Changes save automatically.
        </p>
      </div>

      <div className={ui.card}>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-zinc-900">Sound effects</span>
            <span className="block text-xs text-zinc-500">
              {enabled ? "On" : "Muted"} — same setting as the in-game speaker button
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void setSoundEnabled(!enabled)}
            className={`relative h-7 w-12 rounded-full transition ${
              enabled ? "bg-violet-600" : "bg-zinc-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </label>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="sound-volume" className="text-sm font-medium text-zinc-900">
              Volume
            </label>
            <span className="text-xs text-zinc-500">{Math.round(volume * 100)}%</span>
          </div>
          <input
            id="sound-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            disabled={!enabled}
            onChange={(event) => void setSoundVolume(parseFloat(event.target.value))}
            className="mt-2 w-full accent-violet-600 disabled:opacity-40"
          />
        </div>

        {!enabled && (
          <p className="mt-4 text-xs text-zinc-500">
            While muted, no sound effects play — including button taps and celebrations.
          </p>
        )}
      </div>
    </div>
  );
}
