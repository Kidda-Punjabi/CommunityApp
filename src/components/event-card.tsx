import Link from "next/link";
import { HubCard, StatusBadge } from "@/components/ui/hub-primitives";
import { TIER_LABELS, type MembershipTier } from "@/lib/membership/tiers";

export type EventItem = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  meeting_url: string | null;
  external_url: string | null;
  required_tier: string | null;
  is_free: boolean;
};

type EventCardProps = {
  event: EventItem;
  canAccess: boolean;
  requiredTier?: MembershipTier | null;
  recurrenceLabel?: string | null;
};

function formatEventDateTime(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endsAt) {
    return `${date} · ${startTime}`;
  }

  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${date} · ${startTime}–${endTime}`;
}

function formatEventMeta(
  event: EventItem,
  recurrenceLabel?: string | null
): string | null {
  const parts: string[] = [];

  if (event.meeting_url) {
    parts.push("Google Meet");
  } else if (event.location) {
    parts.push(event.location);
  }

  if (recurrenceLabel) {
    parts.push(recurrenceLabel.toLowerCase());
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function tierBadgeLabel(
  event: EventItem,
  requiredTier?: MembershipTier | null
): string {
  if (event.is_free) return "Open";
  if (requiredTier) return TIER_LABELS[requiredTier];
  return "Members";
}

export function EventCard({
  event,
  canAccess,
  requiredTier,
  recurrenceLabel,
}: EventCardProps) {
  const joinUrl = event.meeting_url || event.external_url;
  const metaLine = formatEventMeta(event, recurrenceLabel);

  return (
    <HubCard>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-violet-600">
          {formatEventDateTime(event.starts_at, event.ends_at)}
        </p>
        <StatusBadge variant={event.is_free ? "success" : "neutral"}>
          {tierBadgeLabel(event, requiredTier)}
        </StatusBadge>
      </div>

      <h3 className="mt-2 text-base font-medium text-zinc-900">{event.title}</h3>

      {metaLine ? (
        <p className="mt-2 text-sm text-zinc-500">
          {event.meeting_url ? <span aria-hidden="true">🎥 </span> : null}
          {metaLine}
        </p>
      ) : null}

      {event.description ? (
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{event.description}</p>
      ) : null}

      {!canAccess && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-zinc-500">
            Unlock with{" "}
            <span className="font-medium text-zinc-700">
              {requiredTier ? TIER_LABELS[requiredTier] : "a course purchase"}
            </span>
            .
          </p>
          <Link
            href="/courses"
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            View courses
          </Link>
        </div>
      )}

      {canAccess && joinUrl ? (
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          {event.meeting_url ? "Join event" : "More details"}
        </a>
      ) : null}
    </HubCard>
  );
}
