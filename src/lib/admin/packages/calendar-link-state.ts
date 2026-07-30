import type { AdminPackageListRow, CohortCalendarLinkState } from "@/lib/admin/packages/types";
import type { PackageInstanceStatus } from "@/lib/admin/package-status";

const CALENDAR_ATTENTION_STATUSES: PackageInstanceStatus[] = [
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
];

export function packageInstanceHasConfirmedStudent(row: AdminPackageListRow): boolean {
  return row.confirmed.some((member) => Boolean(member.userId));
}

/** Calendar column state — honours live roster when server row is stale after inline edits. */
export function resolvePackageCalendarLinkState(row: AdminPackageListRow): CohortCalendarLinkState {
  if (row.kind === "community") return "n_a";

  const stored = row.calendarLinkState ?? "unlinked";

  if (row.kind === "cohort") return stored;

  if (!packageInstanceHasConfirmedStudent(row)) {
    return "no_student";
  }

  if (stored === "no_student") {
    if (row.calendarLinkedEvent) return "linked";
    if (!row.tutorId) return "no_tutor";
    return "unlinked";
  }

  return stored;
}

export function packageCalendarNeedsAttention(row: AdminPackageListRow): boolean {
  const state = resolvePackageCalendarLinkState(row);
  if (state === "n_a" || state === "linked") return false;
  if (!CALENDAR_ATTENTION_STATUSES.includes(row.status)) return false;
  return (
    state === "unlinked" ||
    state === "no_tutor" ||
    state === "no_connection" ||
    state === "no_student"
  );
}
