"use client";

import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { ui } from "@/lib/ui/styles";
import type { DisplayEvent } from "@/lib/events/recurrence";
import type { MembershipTier } from "@/lib/membership/tiers";

export const UPCOMING_EVENTS_PAGE_SIZE = 10;

export type PreparedEvent = {
  event: DisplayEvent;
  canAccess: boolean;
  requiredTier: MembershipTier | null;
  recurrenceLabel: string | null;
};

type UpcomingEventsListProps = {
  events: PreparedEvent[];
};

export function UpcomingEventsList({ events }: UpcomingEventsListProps) {
  const [visibleCount, setVisibleCount] = useState(UPCOMING_EVENTS_PAGE_SIZE);
  const visible = events.slice(0, visibleCount);
  const hasMore = visibleCount < events.length;

  return (
    <>
      <div className={ui.stack}>
        {visible.map(({ event, canAccess, requiredTier, recurrenceLabel }) => (
          <EventCard
            key={event.occurrenceId}
            event={event}
            canAccess={canAccess}
            requiredTier={requiredTier}
            recurrenceLabel={recurrenceLabel}
          />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((count) =>
              Math.min(count + UPCOMING_EVENTS_PAGE_SIZE, events.length)
            )
          }
          className={`mt-4 w-full ${ui.btnSecondary} disabled:opacity-50`}
        >
          Load more
        </button>
      )}
    </>
  );
}
