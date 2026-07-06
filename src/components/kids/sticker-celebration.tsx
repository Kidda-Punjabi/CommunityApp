"use client";

import { useEffect } from "react";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { usePlaySoundOnce } from "@/lib/audio/use-play-sound";
import type { KidSticker } from "@/lib/kids/types";

export function StickerCelebration({
  sticker,
  onDone,
}: {
  sticker: KidSticker;
  onDone: () => void;
}) {
  usePlaySoundOnce("sticker_earned");

  useEffect(() => {
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="animate-bounce rounded-3xl bg-gradient-to-b from-amber-100 to-orange-100 px-10 py-12 text-center shadow-2xl">
        <p className="text-lg font-bold text-amber-800">New sticker!</p>
        <KidLucideIcon name={sticker.sticker_icon} className="mx-auto mt-4 h-20 w-20 text-amber-500" />
        <p className="mt-4 text-xl font-bold text-zinc-900">{sticker.sticker_name}</p>
      </div>
    </div>
  );
}
