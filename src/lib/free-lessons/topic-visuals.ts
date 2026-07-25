import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Bus,
  CalendarDays,
  CloudSun,
  CookingPot,
  Compass,
  Footprints,
  HandHeart,
  Heart,
  Home,
  MapPinned,
  Music,
  PawPrint,
  PartyPopper,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Users,
  UtensilsCrossed,
  Clock3,
  Church,
  Handshake,
  Smile,
  WandSparkles,
} from "lucide-react";

export const TOPIC_MASTERY_MAX_LEVEL = 5;

/** Questions required to pass each activity level (gets harder). */
export const ACTIVITY_QUESTION_COUNTS = [4, 5, 6, 7, 8] as const;

/** Minimum correct % to pass each level. */
export const ACTIVITY_PASS_THRESHOLDS = [60, 70, 75, 80, 85] as const;

export type TopicVisual = {
  Icon: LucideIcon;
  /** Tailwind background for the inner circle */
  fillClass: string;
  /** Stroke color for progress ring (CSS color) */
  ringColor: string;
};

const PALETTE = [
  { fillClass: "bg-amber-400", ringColor: "#FBBF24" },
  { fillClass: "bg-emerald-500", ringColor: "#10B981" },
  { fillClass: "bg-sky-500", ringColor: "#0EA5E9" },
  { fillClass: "bg-rose-500", ringColor: "#F43F5E" },
  { fillClass: "bg-fuchsia-500", ringColor: "#D946EF" },
  { fillClass: "bg-orange-500", ringColor: "#F97316" },
  { fillClass: "bg-teal-500", ringColor: "#14B8A6" },
  { fillClass: "bg-indigo-500", ringColor: "#6366F1" },
] as const;

function pickPalette(seed: number) {
  return PALETTE[Math.abs(seed) % PALETTE.length];
}

export function getTopicVisual(title: string, sortIndex: number): TopicVisual {
  const t = title.toLowerCase();
  const palette = pickPalette(sortIndex);

  let Icon: LucideIcon = Sparkles;
  if (t.includes("welcome") || t.includes("introduction")) Icon = Handshake;
  else if (t.includes("family")) Icon = Users;
  else if (t.includes("number") || t.includes("counting") || t.includes("time"))
    Icon = Clock3;
  else if (t.includes("day") || t.includes("date")) Icon = CalendarDays;
  else if (t.includes("everyday") || t.includes("verb") || t.includes("action"))
    Icon = Footprints;
  else if (t.includes("house") || t.includes("home")) Icon = Home;
  else if (t.includes("ability") || t.includes("can do")) Icon = WandSparkles;
  else if (t.includes("feeling") || t.includes("emotion")) Icon = Smile;
  else if (t.includes("animal")) Icon = PawPrint;
  else if (t.includes("shop") || t.includes("money")) Icon = ShoppingBag;
  else if (t.includes("food") || t.includes("recipe")) Icon = CookingPot;
  else if (t.includes("position") || t.includes("direction")) Icon = Compass;
  else if (t.includes("describ") || t.includes("adjective") || t.includes("people"))
    Icon = Heart;
  else if (t.includes("transport") || t.includes("getting around")) Icon = Bus;
  else if (t.includes("celebration") || t.includes("festival")) Icon = PartyPopper;
  else if (t.includes("yesterday") || t.includes("past")) Icon = CalendarDays;
  else if (t.includes("weather") || t.includes("season")) Icon = CloudSun;
  else if (t.includes("plan") || t.includes("dream") || t.includes("future"))
    Icon = Sparkles;
  else if (t.includes("health") || t.includes("body")) Icon = Stethoscope;
  else if (t.includes("giving direction")) Icon = MapPinned;
  else if (t.includes("wedding") || t.includes("cultural")) Icon = PartyPopper;
  else if (t.includes("music") || t.includes("pop")) Icon = Music;
  else if (t.includes("grandparent") || t.includes("elder")) Icon = HandHeart;
  else if (t.includes("gurdwara") || t.includes("community space")) Icon = Church;
  else if (t.includes("baby") || t.includes("kid")) Icon = Baby;
  else if (t.includes("eat") || t.includes("meal")) Icon = UtensilsCrossed;

  return { Icon, ...palette };
}
