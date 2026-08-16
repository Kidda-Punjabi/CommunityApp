import type { LucideIcon } from "lucide-react";
import { BookOpen, CalendarDays, Compass, Sparkles } from "lucide-react";

/**
 * Visual metadata for the Learn hub stack and related screens.
 * Hex values follow the Learn mockup; Tailwind classes map onto the same
 * tint/shade pattern already used for Foundational (violet) and Beginner (amber).
 */
export type LearnCourseLevelId =
  | "foundational"
  | "beginners"
  | "intermediate"
  | "advanced";

export type LearnCourseLevelTheme = {
  id: LearnCourseLevelId;
  title: string;
  shortTitle: string;
  cefr: string;
  duration: string;
  whatYouLearn: string;
  byTheEnd: string;
  rowBg: string;
  ink: string;
  mutedInk: string;
  iconWrap: string;
  tagBg: string;
  tagInk: string;
  ctaClass: string;
  Icon: LucideIcon;
};

export const LEARN_COURSE_LEVELS: Record<LearnCourseLevelId, LearnCourseLevelTheme> = {
  foundational: {
    id: "foundational",
    title: "Foundational",
    shortTitle: "Foundational",
    cefr: "Pre-A1",
    duration: "4 hours",
    whatYouLearn:
      "Punjabi sounds, the alphabet, laga maatra, and speaking aloud with live feedback.",
    byTheEnd:
      "You'll pronounce Punjabi clearly, read basic words, and be ready for the Beginners course.",
    rowBg: "bg-[#EDE9FE]",
    ink: "text-[#2E1065]",
    mutedInk: "text-[#5B21B6]/80",
    iconWrap: "bg-[#7C3AED]/15 text-[#6D28D9]",
    tagBg: "bg-white/70",
    tagInk: "text-[#5B21B6]",
    ctaClass: "bg-[#7C3AED] text-white hover:bg-[#6D28D9]",
    Icon: BookOpen,
  },
  beginners: {
    id: "beginners",
    title: "Beginner",
    shortTitle: "Beginner",
    cefr: "A2",
    duration: "12 weeks",
    whatYouLearn:
      "Live speaking, greetings, everyday sentences, questions, and the tenses you need for real conversation.",
    byTheEnd:
      "You'll combine tenses, ask questions, and hold everyday Punjabi dialogues with confidence.",
    rowBg: "bg-[#FEF3C7]",
    ink: "text-[#451A03]",
    mutedInk: "text-[#92400E]/80",
    iconWrap: "bg-[#D97706]/15 text-[#B45309]",
    tagBg: "bg-white/70",
    tagInk: "text-[#92400E]",
    ctaClass: "bg-[#D97706] text-white hover:bg-[#B45309]",
    Icon: CalendarDays,
  },
  intermediate: {
    id: "intermediate",
    title: "Intermediate",
    shortTitle: "Intermediate",
    cefr: "B1",
    duration: "Coming soon",
    whatYouLearn:
      "Longer conversations, opinions, and the language you need for work, family, and community life.",
    byTheEnd:
      "You'll follow natural Punjabi at a steady pace and express yourself in more complex situations.",
    rowBg: "bg-zinc-100",
    ink: "text-zinc-600",
    mutedInk: "text-zinc-500",
    iconWrap: "bg-zinc-200/80 text-zinc-400",
    tagBg: "bg-zinc-200/90",
    tagInk: "text-zinc-600",
    ctaClass: "bg-zinc-500 text-white hover:bg-zinc-600",
    Icon: Compass,
  },
  advanced: {
    id: "advanced",
    title: "Advanced",
    shortTitle: "Advanced",
    cefr: "B2",
    duration: "Coming soon",
    whatYouLearn:
      "Nuance, debate, and confident Punjabi across formal and informal settings.",
    byTheEnd:
      "You'll handle extended discussion and understand Punjabi closer to native pace.",
    rowBg: "bg-zinc-100",
    ink: "text-zinc-600",
    mutedInk: "text-zinc-500",
    iconWrap: "bg-zinc-200/80 text-zinc-400",
    tagBg: "bg-zinc-200/90",
    tagInk: "text-zinc-600",
    ctaClass: "bg-zinc-500 text-white hover:bg-zinc-600",
    Icon: Sparkles,
  },
};

export const LEARN_COURSE_STACK: LearnCourseLevelId[] = [
  "foundational",
  "beginners",
  "intermediate",
  "advanced",
];

export function isComingSoonLevel(
  id: LearnCourseLevelId
): id is "intermediate" | "advanced" {
  return id === "intermediate" || id === "advanced";
}

export function courseDetailPath(id: LearnCourseLevelId) {
  return `/dashboard/learn/courses/${id}`;
}
