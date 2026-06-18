import Link from "next/link";
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

function formatEventDate(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
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

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${date} · ${startTime} – ${endTime}`;
  }

  return `${date} ${startTime} – ${end.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} ${endTime}`;
}

export function EventCard({
  event,
  canAccess,
  requiredTier,
  recurrenceLabel,
}: EventCardProps) {
  const joinUrl = event.meeting_url || event.external_url;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            {formatEventDate(event.starts_at, event.ends_at)}
          </p>
          <h3 className="mt-1 font-semibold text-zinc-900">{event.title}</h3>
          {recurrenceLabel && (
            <p className="mt-1 text-xs font-medium text-violet-600">{recurrenceLabel}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            event.is_free
              ? "bg-green-50 text-green-700"
              : "bg-violet-50 text-violet-700"
          }`}
        >
          {event.is_free ? "Open" : requiredTier ? TIER_LABELS[requiredTier] : "Members"}
        </span>
      </div>

      {event.location && (
        <p className="mt-2 text-sm text-zinc-600">{event.location}</p>
      )}

      {event.description && (
        <p className="mt-3 text-sm text-zinc-500">{event.description}</p>
      )}

      {!canAccess && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-500">
            Unlock with{" "}
            <span className="font-medium text-zinc-700">
              {requiredTier ? TIER_LABELS[requiredTier] : "a course purchase"}
            </span>
            .
          </p>
          <Link
            href="/dashboard/membership"
            className="inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            View courses →
          </Link>
        </div>
      )}

      {canAccess && joinUrl && (
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {event.meeting_url ? "Join event" : "More details"}
        </a>
      )}
    </div>
  );
}
