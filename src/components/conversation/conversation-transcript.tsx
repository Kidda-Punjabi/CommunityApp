"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationMessageBubble,
  type ConversationMessageRole,
} from "@/components/conversation/conversation-bubble";
import { ConversationAudioPlayer } from "@/lib/conversation/conversation-audio-player";
import type { ConversationDisplayPreferences } from "@/lib/conversation/display-preferences";
import type { ConversationCharacter } from "@/lib/conversation/types";

export type TranscriptEntry = {
  id: string;
  role: ConversationMessageRole;
  gurmukhi: string;
  romanised: string | null;
  english: string | null;
  audioUrl?: string | null;
};

type ConversationTranscriptProps = {
  entries: TranscriptEntry[];
  character: ConversationCharacter;
  displayPreferences: ConversationDisplayPreferences;
  audioPlayer: ConversationAudioPlayer;
  autoplayEntryId?: string | null;
  onAutoplayEntryIdConsumed?: () => void;
};

export function ConversationTranscript({
  entries,
  character,
  displayPreferences,
  audioPlayer,
  autoplayEntryId,
  onAutoplayEntryIdConsumed,
}: ConversationTranscriptProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const lastAutoplayRef = useRef<string | null>(null);

  useEffect(() => {
    audioPlayer.attach(setPlayingEntryId);
    return () => audioPlayer.dispose();
  }, [audioPlayer]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length]);

  useEffect(() => {
    if (!autoplayEntryId || autoplayEntryId === lastAutoplayRef.current) return;

    const entry = entries.find((item) => item.id === autoplayEntryId);
    if (!entry?.audioUrl?.trim()) {
      onAutoplayEntryIdConsumed?.();
      return;
    }

    lastAutoplayRef.current = autoplayEntryId;
    void audioPlayer.replayEntry(entry.id, entry.audioUrl).then((played) => {
      if (!played) {
        setAudioNotice("Could not play audio");
        window.setTimeout(() => setAudioNotice(null), 2200);
      }
      onAutoplayEntryIdConsumed?.();
    });
  }, [autoplayEntryId, entries, audioPlayer, onAutoplayEntryIdConsumed]);

  const handlePlayEntry = useCallback(
    async (entry: TranscriptEntry) => {
      const url = entry.audioUrl?.trim();
      if (!url) {
        setAudioNotice("Recording not available yet");
        window.setTimeout(() => setAudioNotice(null), 2200);
        return;
      }

      setAudioNotice(null);
      const played = await audioPlayer.replayEntry(entry.id, url);
      if (!played) {
        setAudioNotice("Could not play audio");
        window.setTimeout(() => setAudioNotice(null), 2200);
      }
    },
    [audioPlayer]
  );

  return (
    <div className="space-y-2">
      {audioNotice ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{audioNotice}</p>
      ) : null}
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
              audioUrl={entry.audioUrl}
              isPlaying={playingEntryId === entry.id}
              displayPreferences={displayPreferences}
              onPlay={
                entry.audioUrl?.trim() ? () => void handlePlayEntry(entry) : undefined
              }
            />
          ))}
          <div ref={endRef} className="h-px shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
