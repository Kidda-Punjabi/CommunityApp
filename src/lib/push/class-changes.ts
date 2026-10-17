import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push/send";
import { classStartMoved } from "@/lib/push/class-move";
import { formatLocalDay, formatLocalTime } from "@/lib/push/policy";

export type ClassScheduleChange = {
  sessionId: string;
  studentId: string | null;
  cohortId: string | null;
  title: string;
  matchMethod: string | null;
  startsAt: string;
  oldStartsAt?: string;
  newStartsAt?: string;
  kind: "moved" | "cancelled";
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export async function notifyClassScheduleChanges(
  admin: SupabaseClient,
  changes: ClassScheduleChange[]
): Promise<void> {
  const relevant = changes.filter((change) => {
    if (change.matchMethod === "unmatched" || change.matchMethod === "title_name") return false;
    if (!change.studentId && !(change.cohortId && change.title.toLowerCase().includes("kidda class"))) {
      return false;
    }
    const when = new Date(change.newStartsAt ?? change.startsAt).getTime();
    return change.kind === "cancelled" || (when > Date.now() && when - Date.now() < TWO_WEEKS_MS);
  });
  if (relevant.length === 0) return;

  const cohortIds = [...new Set(relevant.map((change) => change.cohortId).filter(Boolean))] as string[];
  const { data: members } = cohortIds.length
    ? await admin
        .from("cohort_members")
        .select("cohort_id, user_id, kid_profile_id")
        .in("cohort_id", cohortIds)
        .is("left_at", null)
    : { data: [] };

  const recipients = new Map<string, Array<{ userId: string; kidProfileId: string | null }>>();
  for (const change of relevant) {
    const people: Array<{ userId: string; kidProfileId: string | null }> = [];
    if (change.studentId) people.push({ userId: change.studentId, kidProfileId: null });
    for (const member of members ?? []) {
      if (member.cohort_id !== change.cohortId || !member.user_id) continue;
      people.push({
        userId: member.user_id as string,
        kidProfileId: (member.kid_profile_id as string | null) ?? null,
      });
    }
    recipients.set(change.sessionId + change.kind, people);
  }

  const userIds = [...new Set([...recipients.values()].flat().map((person) => person.userId))];
  const timezones = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, timezone").in("id", userIds);
    for (const profile of profiles ?? []) {
      timezones.set(profile.id as string, (profile.timezone as string | null)?.trim() || "Europe/London");
    }
  }

  for (const change of relevant) {
    for (const recipient of recipients.get(change.sessionId + change.kind) ?? []) {
      const zone = timezones.get(recipient.userId) ?? "Europe/London";
      if (
        change.kind === "moved" &&
        change.oldStartsAt &&
        change.newStartsAt &&
        classStartMoved(change.oldStartsAt, change.newStartsAt)
      ) {
        await sendPush({
          userId: recipient.userId,
          kidProfileId: recipient.kidProfileId,
          type: "C4",
          refKey: `${change.sessionId}:${change.newStartsAt}`,
          title: "Your class has moved",
          body: `${formatLocalDay(change.oldStartsAt, zone)} class is now ${formatLocalDay(change.newStartsAt, zone)}, ${formatLocalTime(change.newStartsAt, zone)}.`,
          url: "/dashboard/schedule",
          expiresAt: new Date(change.newStartsAt),
        });
      }
      if (change.kind === "cancelled") {
        await sendPush({
          userId: recipient.userId,
          kidProfileId: recipient.kidProfileId,
          type: "C5",
          refKey: change.sessionId,
          title: "Class cancelled",
          body: `Your class on ${formatLocalDay(change.startsAt, zone)} is cancelled. Your tutor will be in touch about the next one.`,
          url: "/dashboard/schedule",
        });
      }
    }
  }
}
