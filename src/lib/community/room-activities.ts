import type { CommunityBand } from "@/lib/community/constants";
import { FLASHCARD_CARD_TYPE_LABELS, type FlashcardCardType } from "@/lib/flashcards/types";

export type RoomActivityKind =
  | "warmup_debate"
  | "flashcards"
  | "point_race"
  | "quiz"
  | "speak_it"
  | "speaking_prompts"
  | "bonus";

export type TopicOffer = {
  lessonId: string | null;
  deckName: string | null;
  deckId: string | null;
  topicTags: string[];
  quizId: string | null;
  quizTitle: string | null;
  speakingPromptCount: number;
  /** Card types present in the week's Community deck. Missing means words only. */
  cardTypes?: FlashcardCardType[];
};

/** Which flashcard type suits each level, best first (approved 29 Oct 2026). */
const CARD_TYPE_PREFERENCE: Record<CommunityBand, FlashcardCardType[]> = {
  sounds: ["word", "sentence"],
  beginner: ["word", "sentence"],
  intermediate: ["question", "sentence", "word"],
  advanced: ["speak", "question", "sentence"],
};

export function cardTypeForBand(band: CommunityBand, available: FlashcardCardType[] | undefined): FlashcardCardType | null {
  const have = new Set(available && available.length > 0 ? available : (["word"] as FlashcardCardType[]));
  return CARD_TYPE_PREFERENCE[band].find((type) => have.has(type)) ?? null;
}

export function flashcardInstruction(type: FlashcardCardType): string {
  if (type === "question") return "Take turns: one person answers each card out loud.";
  if (type === "speak") return "Each person talks for 60 seconds on a card.";
  if (type === "sentence") return "Say each sentence out loud before you flip it.";
  return "Go through this week's cards together.";
}

export type DebatePick = {
  id: string;
  prompt: string;
  optionA: string;
  optionB: string;
  promptPa: string | null;
  romanised: string | null;
};

export type PlannedActivity = {
  position: number;
  kind: RoomActivityKind;
  title: string;
  payload: Record<string, unknown>;
};

function mix(seed: string): () => number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  return copy;
}

export const ACTIVITY_TITLES: Record<RoomActivityKind, string> = {
  warmup_debate: "Warm-up debate",
  flashcards: "Flashcards",
  point_race: "Point Race",
  quiz: "Quick quiz",
  speak_it: "Speak It",
  speaking_prompts: "Speaking prompts",
  bonus: "Bonus round",
};

function topicKinds(band: CommunityBand, topic: TopicOffer): RoomActivityKind[] {
  const beginner = band === "sounds" || band === "beginner";
  const kinds: RoomActivityKind[] = [];
  if (beginner) {
    if (topic.deckId && topic.lessonId) kinds.push("flashcards");
    if (topic.topicTags.length > 0) kinds.push("point_race");
    if (topic.quizId) kinds.push("quiz");
  } else {
    const deckType = cardTypeForBand(band, topic.cardTypes);
    if (topic.deckId && topic.lessonId && deckType && deckType !== "word") kinds.push("flashcards");
    if (topic.speakingPromptCount > 0) kinds.push("speaking_prompts");
    if (topic.topicTags.length > 0) kinds.push("point_race");
    if (topic.deckName) kinds.push("speak_it");
  }
  return kinds;
}

export function payloadFor(
  kind: RoomActivityKind,
  topic: TopicOffer,
  debate: DebatePick,
  band: CommunityBand
): Record<string, unknown> {
  if (kind === "warmup_debate") {
    return {
      debateId: debate.id,
      prompt: debate.prompt,
      optionA: debate.optionA,
      optionB: debate.optionB,
      promptPa: debate.promptPa,
      romanised: debate.romanised,
      instruction: "Vote, then each person says why in Punjabi.",
    };
  }
  if (kind === "flashcards") {
    const cardType = cardTypeForBand(band, topic.cardTypes) ?? "word";
    return {
      lessonId: topic.lessonId,
      deckId: topic.deckId,
      deckName: topic.deckName,
      cardType,
      instruction: flashcardInstruction(cardType),
    };
  }
  if (kind === "point_race") {
    return {
      topicTags: topic.topicTags.slice(0, 8),
      questionCount: 10,
      gameRoomId: null,
      joinCode: null,
      instruction: "Race through 10 questions. First to finish wins.",
    };
  }
  if (kind === "quiz") {
    return {
      quizId: topic.quizId,
      quizTitle: topic.quizTitle,
      instruction: "Answer this week's quiz on your phone.",
    };
  }
  if (kind === "speaking_prompts") {
    return {
      deckName: topic.deckName,
      lessonId: topic.lessonId,
      instruction: "Each person answers the prompt out loud.",
    };
  }
  if (kind === "speak_it") {
    return {
      deckName: topic.deckName,
      lessonId: topic.lessonId,
      instruction: "Say the line out loud. Mute yourself on the call.",
    };
  }
  return {
    deckName: topic.deckName,
    topicTags: topic.topicTags.slice(0, 8),
    questionCount: 10,
    gameRoomId: null,
    joinCode: null,
    gameType: null,
    instruction: "Pick a game to play together on this week's topic.",
  };
}

export function planRoomActivities(input: {
  roomId: string;
  band: CommunityBand;
  topic: TopicOffer;
  debate: DebatePick;
}): PlannedActivity[] {
  const random = mix(input.roomId);
  const available = topicKinds(input.band, input.topic);
  const chosen =
    available.length === 0
      ? (["point_race"] as RoomActivityKind[])
      : shuffle(available, random).slice(0, available.length >= 3 && random() < 0.5 ? 2 : Math.min(3, available.length));
  const genericRace = input.topic.topicTags.length === 0;
  const kinds: RoomActivityKind[] = ["warmup_debate", ...chosen, "bonus"];
  return kinds.map((kind, index) => ({
    position: index,
    kind,
    title:
      kind === "quiz" && input.topic.quizTitle
        ? input.topic.quizTitle
        : kind === "flashcards"
          ? `Flashcards · ${FLASHCARD_CARD_TYPE_LABELS[cardTypeForBand(input.band, input.topic.cardTypes) ?? "word"]}`
          : ACTIVITY_TITLES[kind],
    payload:
      kind === "point_race" && genericRace && available.length === 0
        ? { ...payloadFor(kind, input.topic, input.debate, input.band), topicTags: [], questionCount: 10 }
        : payloadFor(kind, input.topic, input.debate, input.band),
  }));
}

export function pickDebateId(roomId: string, debateIds: string[]): string | null {
  if (debateIds.length === 0) return null;
  const random = mix(`${roomId}:debate`);
  const sorted = [...debateIds].sort();
  return sorted[Math.floor(random() * sorted.length)] ?? null;
}


/** One line on what each activity is, for the host's add / swap picker. */
export const ACTIVITY_DESCRIPTIONS: Record<RoomActivityKind, string> = {
  warmup_debate: "A light either/or question. Everyone votes, then says why in Punjabi.",
  flashcards: "This week's cards on each phone. Done when everyone finishes the deck.",
  point_race: "A 10-question race on this week's topic. First to finish wins.",
  quiz: "This week's quiz on each phone. Marks itself done when finished.",
  speak_it: "Read the English, say it in Punjabi to your phone. Mute on the call.",
  speaking_prompts: "Prompt cards answered out loud, one person at a time.",
  bonus: "The room picks a game on this week's topic. Runs until you bring everyone back.",
};

/** Which levels each activity suits, for grouping the host's picker Beginner, Intermediate, Advanced. */
export const ACTIVITY_BANDS: Record<RoomActivityKind, ("beginner" | "intermediate" | "advanced")[]> = {
  warmup_debate: ["beginner", "intermediate", "advanced"],
  flashcards: ["beginner"],
  quiz: ["beginner", "intermediate"],
  point_race: ["beginner", "intermediate", "advanced"],
  speak_it: ["intermediate", "advanced"],
  speaking_prompts: ["intermediate", "advanced"],
  bonus: ["beginner", "intermediate", "advanced"],
};

/** Kinds this week's content can actually support, whatever the room's level. */
export function kindsWithContent(topic: TopicOffer): RoomActivityKind[] {
  const kinds: RoomActivityKind[] = ["warmup_debate"];
  if (topic.deckId && topic.lessonId) kinds.push("flashcards");
  if (topic.quizId) kinds.push("quiz");
  kinds.push("point_race");
  if (topic.deckName) kinds.push("speak_it");
  if (topic.speakingPromptCount > 0) kinds.push("speaking_prompts");
  kinds.push("bonus");
  return kinds;
}
