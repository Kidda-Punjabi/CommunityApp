"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/ui/styles";

type EnglishOptionSpeechMuteToggleProps = {
  muted: boolean;
  onChange: (muted: boolean) => void;
};

/**
 * Mute/unmute automatic English readout when selecting an answer option.
 */
export function EnglishOptionSpeechMuteToggle({
  muted,
  onChange,
}: EnglishOptionSpeechMuteToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={muted ? "Unmute answer readout" : "Mute answer readout"}
      title={muted ? "Answer readout off" : "Answer readout on"}
      onClick={() => onChange(!muted)}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
        muted
          ? "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
          : "border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
      )}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" aria-hidden />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
