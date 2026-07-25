import {
  ACTIVITY_PASS_THRESHOLDS,
} from "@/lib/free-lessons/topic-visuals";

/** Shared copy for activity levels (mirrors build-activity). */
export function activityMetaForLevel(masteryLevel: number): {
  title: string;
  subtitle: string;
  passThreshold: number;
} | null {
  if (masteryLevel >= 5) return null;
  const level = Math.min(4, Math.max(0, masteryLevel)) as 0 | 1 | 2 | 3 | 4;
  const titles = [
    { title: "Warm-up", subtitle: "Match the English meaning to the Punjabi phrase." },
    { title: "Practice", subtitle: "A little harder — more phrases, same idea." },
    { title: "Challenge", subtitle: "Now go the other way: Punjabi → English." },
    { title: "Stretch", subtitle: "Tougher mix — stay sharp." },
    { title: "Mastery check", subtitle: "Prove you’ve got this topic." },
  ] as const;

  return {
    ...titles[level],
    passThreshold: ACTIVITY_PASS_THRESHOLDS[level],
  };
}
