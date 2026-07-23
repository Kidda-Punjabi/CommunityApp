"use client";

import { useRef } from "react";
import { GameTutorialHelpButton } from "@/components/games/tutorial/game-tutorial-help-button";
import { GameTutorialOverlay } from "@/components/games/tutorial/game-tutorial-overlay";
import { useGameTutorial } from "@/components/games/tutorial/use-game-tutorial";
import type { TutorialId } from "@/lib/games/tutorials/types";

type GameTutorialHostProps = {
  tutorialId: TutorialId;
  className?: string;
  helpClassName?: string;
};

/**
 * Drop-in first-play tutorial + help button for a game start screen.
 * Auto-opens once per tutorialId until the player opts out via "Don't show again".
 */
export function GameTutorialHost({
  tutorialId,
  className = "",
  helpClassName = "",
}: GameTutorialHostProps) {
  const { content, isOpen, open, close } = useGameTutorial(tutorialId);
  const openedFromHelpRef = useRef(false);

  if (!content) return null;

  return (
    <div className={className}>
      <GameTutorialHelpButton
        className={helpClassName}
        onClick={() => {
          openedFromHelpRef.current = true;
          open();
        }}
      />
      <GameTutorialOverlay
        content={content}
        open={isOpen}
        preferDontShowAgain={!openedFromHelpRef.current}
        onClose={(options) => {
          close(options);
          openedFromHelpRef.current = false;
        }}
      />
    </div>
  );
}
