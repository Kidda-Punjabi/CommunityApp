"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlashcardStudyMode } from "@/components/flashcards/study-mode";
import { useKidActivityComplete } from "@/components/kids/use-kid-activity-complete";
import type { FlashcardDeckContext } from "@/lib/flashcards/types";

export function KidFlashcardStudyClient({ deck }: { deck: FlashcardDeckContext }) {
  const router = useRouter();
  const { completeActivity, celebration } = useKidActivityComplete();
  const [done, setDone] = useState(false);

  if (done && !celebration) {
    router.push("/dashboard/kids");
  }

  return (
    <>
      <FlashcardStudyMode
        deck={deck}
        initialProgress={[]}
        kidsMode
        onKidsComplete={async () => {
          await completeActivity("flashcard_study", { deck: deck.deckName });
          setDone(true);
        }}
      />
      {celebration}
    </>
  );
}
