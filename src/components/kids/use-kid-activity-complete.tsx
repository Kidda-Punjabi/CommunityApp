"use client";

import { useCallback, useState } from "react";
import type { KidSticker } from "@/lib/kids/types";
import { StickerCelebration } from "@/components/kids/sticker-celebration";

export function useKidActivityComplete() {
  const [sticker, setSticker] = useState<KidSticker | null>(null);

  const completeActivity = useCallback(
    async (activityType: string, metadata?: Record<string, unknown>) => {
      const response = await fetch("/api/kids/complete-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType, metadata }),
      });
      const data = (await response.json()) as { sticker?: KidSticker | null };
      if (data.sticker) {
        setSticker(data.sticker);
      }
    },
    []
  );

  const celebration = sticker ? (
    <StickerCelebration sticker={sticker} onDone={() => setSticker(null)} />
  ) : null;

  return { completeActivity, celebration };
}
