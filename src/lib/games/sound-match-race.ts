import type { GameRoomSettings } from "@/lib/game-rooms/types";
import {
  SOUND_MATCH_FULL_ID,
  activeGroupIds,
  buildOptions,
  lettersForSelection,
  type SoundMatchLetter,
} from "@/lib/games/sound-match";

export type SoundMatchRacePayload = {
  question_id: string;
  flashcard_id: string;
  prompt: string;
  letter: string;
  audio_url: string;
  options: string[];
  correct_answer: string;
};

export function soundMatchGroupsFromSettings(settings?: GameRoomSettings | null): string[] {
  const raw = settings?.sound_match_groups;
  if (!Array.isArray(raw) || raw.length === 0) return [SOUND_MATCH_FULL_ID];
  const groups = raw.map((value) => String(value).trim()).filter(Boolean);
  return groups.length > 0 ? groups : [SOUND_MATCH_FULL_ID];
}

export function buildSoundMatchRacePayload(
  letters: SoundMatchLetter[],
  selected: readonly string[]
): SoundMatchRacePayload {
  const wanted = new Set(lettersForSelection(selected));
  const available = letters.filter((letter) => wanted.has(letter.glyph) && letter.audioUrl);
  if (available.length === 0) {
    throw new Error("Not enough letter audio to start Sound Match.");
  }

  const pool = [...new Set(available.map((letter) => letter.glyph))];
  const letter = available[Math.floor(Math.random() * available.length)]!;
  const options = buildOptions(letter.glyph, pool, activeGroupIds(selected));
  const questionId = `${letter.glyph}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    question_id: questionId,
    flashcard_id: questionId,
    prompt: "Which letter do you hear?",
    letter: letter.glyph,
    audio_url: letter.audioUrl,
    options,
    correct_answer: letter.glyph,
  };
}

export function isSoundMatchRacePayload(value: unknown): value is SoundMatchRacePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.audio_url === "string" &&
    typeof record.correct_answer === "string" &&
    Array.isArray(record.options)
  );
}
