import type { PaidCourseTier } from "@/lib/membership/access";

export type LearnTrackId = "free" | "foundational" | "beginners" | "community";

export type LearnTrack = {
  id: LearnTrackId;
  title: string;
  description: string;
  tier: PaidCourseTier | null;
  alwaysUnlocked: boolean;
  unlockUrl?: string;
  lockProductName?: string;
};

export const LEARN_TRACKS: LearnTrack[] = [
  {
    id: "free",
    title: "Free Lessons",
    description: "Survival Phrases, comprehensible input, and your first taste of Kidda.",
    tier: null,
    alwaysUnlocked: true,
  },
  {
    id: "foundational",
    title: "Foundational Course",
    description: "Pronunciation, core vocabulary, and everyday phrases.",
    tier: "foundational",
    alwaysUnlocked: false,
    unlockUrl: "/courses/foundational",
    lockProductName: "Foundational Course",
  },
  {
    id: "beginners",
    title: "Beginners Course",
    description: "Build confidence with guided lessons for early learners.",
    tier: "beginners",
    alwaysUnlocked: false,
    unlockUrl: "/courses/beginners",
    lockProductName: "Beginners Course",
  },
  {
    id: "community",
    title: "Community",
    description: "24 weeks of live sessions, advanced content, and the full Kidda community.",
    tier: "community",
    alwaysUnlocked: false,
    unlockUrl: "/courses/community",
    lockProductName: "Kidda Community",
  },
];

export function getLearnTrack(id: string): LearnTrack | undefined {
  return LEARN_TRACKS.find((track) => track.id === id);
}

export function learnTrackPath(id: LearnTrackId) {
  return `/dashboard/learn/${id}`;
}

/** Learn list URL after finishing catch-up for a course tier (or free lessons). */
export function learnTrackPathForPaidTier(tier: PaidCourseTier): LearnTrackId {
  if (tier === "community") return "community";
  if (tier === "beginners") return "beginners";
  return "foundational";
}
