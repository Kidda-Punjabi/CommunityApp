"use client";

import { useEffect, useRef } from "react";
import { ConversationMessageBubble } from "@/components/conversation/conversation-bubble";
import type { ConversationCharacter } from "@/lib/conversation/types";

export type TranscriptEntry = {
  id: string;
  role: "npc" | "student";
  gurmukhi: string;
  romanised: string | null;
  english: string | null;
};

type ConversationTranscriptProps = {
  entries: TranscriptEntry[];
  character: ConversationCharacter;
};

export function ConversationTranscript({ entries, character }: ConversationTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  return (
    <div
      className="min-h-[36vh] max-h-[min(48vh,400px)] flex-1 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-4 sm:min-h-[40vh] sm:max-h-[min(52vh,420px)] sm:px-4"
      aria-label="Conversation transcript"
    >
      <div className="space-y-4">
        {entries.map((entry) => (
          <ConversationMessageBubble
            key={entry.id}
            role={entry.role}
            character={entry.role === "npc" ? character : undefined}
            gurmukhi={entry.gurmukhi}
            romanised={entry.romanised}
            english={entry.english}
          />
        ))}
        <div ref={endRef} className="h-px shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
