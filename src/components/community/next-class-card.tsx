"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PreparedEvent } from "@/components/upcoming-events-list";
import { HubCard, StatusBadge } from "@/components/ui/hub-primitives";
import { TIER_LABELS } from "@/lib/membership/tiers";

type NextClassCardProps = {
  prepared: PreparedEvent;
};

function formatEventDateTime(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!endsAt) return `${date} · ${startTime}`;

  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${date} · ${startTime}–${endTime}`;
}

function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "Starting now";

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  return `Starts in ${parts.slice(0, 2).join(" ")}`;
}

function tierBadgeLabel(prepared: PreparedEvent): string {
  const { event, requiredTier } = prepared;
  if (event.is_free) return "Open";
  if (requiredTier) return TIER_LABELS[requiredTier];
  return "Members";
}

export function NextClassCard({ prepared }: NextClassCardProps) {
  const { event, canAccess, requiredTier } = prepared;
  const joinUrl = event.meeting_url || event.external_url;
  const [countdown, setCountdown] = useState(() => formatCountdown(event.starts_at));

  useEffect(() => {
    setCountdown(formatCountdown(event.starts_at));
    const timer = window.setInterval(() => {
      setCountdown(formatCountdown(event.starts_at));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [event.starts_at]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900">Next class</h2>
        <Link
          href="/dashboard/community/events"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          See all
        </Link>
      </div>

      <HubCard>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-violet-600">{countdown}</p>
          <StatusBadge variant={event.is_free ? "success" : "neutral"}>
            {tierBadgeLabel(prepared)}
          </StatusBadge>
        </div>

        <h3 className="mt-2 text-base font-semibold text-zinc-900">{event.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {formatEventDateTime(event.starts_at, event.ends_at)}
        </p>

        {!canAccess ? (
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
        ) : null}

        {canAccess && joinUrl ? (
          <a
            href={joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            {event.meeting_url ? "Join" : "More details"}
          </a>
        ) : null}
      </HubCard>
    </section>
  );
}
