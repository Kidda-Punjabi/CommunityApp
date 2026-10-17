export type LevelCopy = {
  now: string;
  next: string;
  recommended: string;
};

export const LEVEL_COPY: Record<number, LevelCopy> = {
  0: {
    now: "You're ready to learn the sounds of Punjabi, including the ones English doesn't have.",
    next: "Greet people, introduce yourself and ask simple questions.",
    recommended: "Foundational course",
  },
  1: {
    now: "You can greet people, introduce yourself and your family, and ask simple questions.",
    next: "Talk about your daily routine, food and what you like.",
    recommended: "Beginners course",
  },
  2: {
    now: "You can talk about your daily routine, food, and what you want and need.",
    next: "Talk about yesterday and tomorrow.",
    recommended: "Beginners course",
  },
  3: {
    now: "You can talk about the past and future and give a short presentation about yourself.",
    next: "Join ideas with because, but and when, and tell a short story.",
    recommended: "Intermediate course",
  },
  4: {
    now: "You can join your ideas together and talk about what you can and can't do.",
    next: "Give your opinion and agree or disagree.",
    recommended: "Intermediate course",
  },
  5: {
    now: "You can share opinions, agree and disagree, and follow family conversation.",
    next: "Talk about what if and adjust how polite you sound.",
    recommended: "Intermediate course",
  },
  6: {
    now: "You can handle what if and hold a guided conversation for a few minutes.",
    next: "Follow fast, natural speech and reply without planning.",
    recommended: "Advanced course",
  },
  7: {
    now: "You can follow fast, natural Punjabi and reply without planning.",
    next: "Use idioms and sayings like a native.",
    recommended: "Advanced course",
  },
  8: {
    now: "You use idioms and sayings and switch tone between elders and friends.",
    next: "Discuss deeper topics with nuance for ten minutes or more.",
    recommended: "Advanced course",
  },
  9: {
    now: "You can discuss deep topics with nuance and pick the right tone for any moment.",
    next: "Keep it alive. Help others at the Community sessions.",
    recommended: "Community",
  },
};

export function gapMessage(understanding: number, speaking: number): string {
  const gap = understanding - speaking;
  if (gap >= 2) {
    return `You understand at Level ${understanding} but speak at Level ${speaking}. That gap is the most common thing we see, and it closes fastest with speaking practice.`;
  }
  if (gap === 1) {
    return "Your understanding is one level ahead of your speaking. Speaking practice will pull them level.";
  }
  return "Your understanding and speaking are level with each other.";
}
