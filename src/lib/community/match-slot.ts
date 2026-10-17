import type { CommunitySlotId } from "@/lib/community/constants";

const EXACT_TITLE: Record<string, CommunitySlotId> = {
  "Kidda Community Class - Canada (Sat, Toronto)": "ca-sat",
  "Kidda Community Class - Canada (Sun, Vancouver)": "ca-sun",
  "Kidda Community Class - Australia (Wed, Sydney/Melbourne)": "au-wed",
  "Kidda Community Class - Australia (Fri, Perth)": "au-fri",
};

const UK_TITLE = "Kidda Community Class";

export function zonedWeekday(iso: string, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/** Match Arsh's Community events. UK Wed and UK Sun share one title, so weekday decides. */
export function matchCommunitySlot(title: string, startsAtIso: string): CommunitySlotId | null {
  const trimmed = title.trim();
  const exact = EXACT_TITLE[trimmed];
  if (exact) return exact;
  if (trimmed !== UK_TITLE) return null;
  const weekday = zonedWeekday(startsAtIso, "Europe/London");
  if (weekday === 0) return "uk-sun";
  if (weekday === 3) return "uk-wed";
  return null;
}
