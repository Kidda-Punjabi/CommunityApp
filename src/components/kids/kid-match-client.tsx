"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { FlashcardMatchMode } from "@/components/flashcards/match-mode";
import { useKidActivityComplete } from "@/components/kids/use-kid-activity-complete";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";

export function KidMatchClient({ deck }: { deck: FlashcardDeckContext }) {
  const router = useRouter();
  const { completeActivity, celebration } = useKidActivityComplete();
  const [done, setDone] = useState(false);

  const handleKidsComplete = useCallback(
    async (score: number) => {
      await completeActivity("memory_match", { score });
      setDone(true);
    },
    [completeActivity]
  );

  if (done && !celebration) {
    router.push("/dashboard/kids");
  }

  return (
    <>
      <FlashcardMatchMode
        deck={deck}
        initialBestScore={0}
        kidsMode
        onKidsComplete={handleKidsComplete}
      />
      {celebration}
    </>
  );
}
