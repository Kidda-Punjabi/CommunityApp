"use client";

import { useCallback, useEffect, useState } from "react";
import { getTutorialContent } from "@/lib/games/tutorials/content";
import {
  hasSeenGameTutorial,
  markGameTutorialSeen,
} from "@/lib/games/tutorials/storage";
import type { GameTutorialContent, TutorialId } from "@/lib/games/tutorials/types";

type UseGameTutorialResult = {
  content: GameTutorialContent | null;
  isOpen: boolean;
  /** True after client has evaluated first-play auto-open. */
  ready: boolean;
  open: () => void;
  close: (options?: { dontShowAgain?: boolean }) => void;
};

export function useGameTutorial(
  tutorialId: TutorialId | null | undefined
): UseGameTutorialResult {
  const content = tutorialId ? getTutorialContent(tutorialId) : null;
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tutorialId) {
      setReady(true);
      setIsOpen(false);
      return;
    }

    const seen = hasSeenGameTutorial(tutorialId);
    setIsOpen(!seen);
    setReady(true);
  }, [tutorialId]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(
    (options?: { dontShowAgain?: boolean }) => {
      if (options?.dontShowAgain && tutorialId) {
        markGameTutorialSeen(tutorialId);
      }
      setIsOpen(false);
    },
    [tutorialId]
  );

  return { content, isOpen, ready, open, close };
}
