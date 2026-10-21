import type { CommunityBand } from "@/lib/community/constants";

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
};

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

const TITLES: Record<RoomActivityKind, string> = {
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
    if (topic.speakingPromptCount > 0) kinds.push("speaking_prompts");
    if (topic.topicTags.length > 0) kinds.push("point_race");
    if (topic.deckName) kinds.push("speak_it");
  }
  return kinds;
}

function payloadFor(kind: RoomActivityKind, topic: TopicOffer, debate: DebatePick): Record<string, unknown> {
  if (kind === "warmup_debate") {
    return {
      debateId: debate.id,
      prompt: debate.prompt,
      optionA: debate.optionA,
      optionB: debate.optionB,
      promptPa: debate.promptPa,
      romanised: debate.romanised,
      instruction: "Vote, then say why out loud.",
    };
  }
  if (kind === "flashcards") {
    return {
      lessonId: topic.lessonId,
      deckId: topic.deckId,
      deckName: topic.deckName,
      instruction: "Go through this week's cards together.",
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
      instruction: "Say the line out loud. Mute yourself on the call.",
    };
  }
  return {
    deckName: topic.deckName,
    instruction: "Practise a focus from this week's deck, or play a game.",
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
    title: kind === "quiz" && input.topic.quizTitle ? input.topic.quizTitle : TITLES[kind],
    payload:
      kind === "point_race" && genericRace && available.length === 0
        ? { ...payloadFor(kind, input.topic, input.debate), topicTags: [], questionCount: 10 }
        : payloadFor(kind, input.topic, input.debate),
  }));
}

export function pickDebateId(roomId: string, debateIds: string[]): string | null {
  if (debateIds.length === 0) return null;
  const random = mix(`${roomId}:debate`);
  const sorted = [...debateIds].sort();
  return sorted[Math.floor(random() * sorted.length)] ?? null;
}
