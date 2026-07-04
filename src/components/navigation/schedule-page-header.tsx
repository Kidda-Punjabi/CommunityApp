"use client";

import { BackLink } from "@/components/navigation/back-link";

export function SchedulePageHeader() {
  return (
    <div className="mb-8">
      <BackLink fallbackHref="/dashboard/home">← Back</BackLink>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Upcoming lessons</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Live sessions with your tutor. Join from here when it&apos;s time.
      </p>
    </div>
  );
}
