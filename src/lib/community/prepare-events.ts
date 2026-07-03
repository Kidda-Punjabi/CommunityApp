import { canAccessEvent } from "@/lib/membership/access";
import { formatRecurrenceLabel } from "@/lib/events/recurrence";
import { normalizeTier } from "@/lib/membership/tiers";
import type { getCourseAccessContext } from "@/lib/membership/unlocked";
import type { PreparedEvent } from "@/components/upcoming-events-list";
import type { splitExpandedEvents } from "@/lib/events/recurrence";

export function prepareCommunityEvents(
  events: ReturnType<typeof splitExpandedEvents>["upcoming"],
  access: Awaited<ReturnType<typeof getCourseAccessContext>>
): PreparedEvent[] {
  return events.map((event) => {
    const requiredTier = event.required_tier ? normalizeTier(event.required_tier) : null;

    return {
      event,
      canAccess: canAccessEvent(access.unlockedCourseIds, event, access.courses),
      requiredTier: requiredTier && requiredTier !== "free" ? requiredTier : null,
      recurrenceLabel: formatRecurrenceLabel(
        event.recurrence_freq,
        event.recurrence_until
      ),
    };
  });
}
