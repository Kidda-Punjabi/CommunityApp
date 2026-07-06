"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useAudioManager } from "@/lib/audio/audio-manager";

type FloatingSoundToggleProps = {
  placement?: "top-right" | "top-left";
};

export function FloatingSoundToggle({ placement = "top-right" }: FloatingSoundToggleProps) {
  const { soundEnabled, setSoundEnabled } = useAudioManager();

  const positionClass =
    placement === "top-left" ? "left-3 top-3" : "right-3 top-3";

  return (
    <button
      type="button"
      onClick={() => void setSoundEnabled(!soundEnabled)}
      aria-label={soundEnabled ? "Mute sound effects" : "Unmute sound effects"}
      className={`fixed ${positionClass} z-40 rounded-full border border-white/40 bg-white/50 p-2 text-zinc-700 opacity-45 shadow-sm backdrop-blur-sm transition hover:bg-white/80 hover:opacity-100 focus:opacity-100`}
    >
      {soundEnabled ? (
        <Volume2 className="h-5 w-5" aria-hidden />
      ) : (
        <VolumeX className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
