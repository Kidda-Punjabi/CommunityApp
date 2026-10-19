import "server-only";

import {
  formatDeletionDate,
  sendDeletionNoticeEmail,
  type DeletionNoticePerson,
} from "@/lib/email/send-deletion-notice";
import { londonDateIso, planDeletionNotice } from "@/lib/storage/deletion-notice";
import type { StorageRef } from "@/lib/storage/linked-user-files";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type NoticeRow = {
  id: string;
  bucket: string;
  path: string;
  subject_label: string | null;
  delete_on: string | null;
  notice_14_sent_at: string | null;
  notice_3_sent_at: string | null;
};

type ProfileRow = { id: string; full_name: string | null; preferred_name: string | null };
type KidRow = { id: string; name: string; parent_user_id: string };

export async function scheduleDeletionNotices(
  admin: SupabaseClient,
  orphans: StorageRef[],
  now = new Date()
): Promise<{ due: StorageRef[]; emailError: string | null; sent14: number; sent3: number }> {
  const today = londonDateIso(now);
  const orphanKeys = new Set(orphans.map(fileKey));

  const { data: stored, error: loadError } = await admin
    .from("data_deletion_notices")
    .select("id, bucket, path, subject_label, delete_on, notice_14_sent_at, notice_3_sent_at, cancelled_at, deleted_at")
    .is("deleted_at", null);
  if (loadError) throw new Error(loadError.message);

  const rows = (stored ?? []) as Array<NoticeRow & { cancelled_at: string | null; deleted_at: string | null }>;
  const byKey = new Map(rows.map((row) => [fileKey(row), row]));

  for (const row of rows) {
    if (row.cancelled_at || orphanKeys.has(fileKey(row))) continue;
    await admin.from("data_deletion_notices").update({ cancelled_at: now.toISOString() }).eq("id", row.id);
  }

  for (const file of orphans) {
    const existing = byKey.get(fileKey(file));
    if (!existing) {
      const { error } = await admin.from("data_deletion_notices").insert({
        bucket: file.bucket,
        path: file.path,
      });
      if (error) throw new Error(error.message);
      continue;
    }
    if (existing.cancelled_at) {
      const { error } = await admin
        .from("data_deletion_notices")
        .update({
          cancelled_at: null,
          deleted_at: null,
          delete_on: null,
          notice_14_sent_at: null,
          notice_3_sent_at: null,
          subject_label: null,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    }
  }

  const { data: openRows, error: openError } = await admin
    .from("data_deletion_notices")
    .select("id, bucket, path, subject_label, delete_on, notice_14_sent_at, notice_3_sent_at")
    .is("deleted_at", null)
    .is("cancelled_at", null);
  if (openError) throw new Error(openError.message);

  const open = (openRows ?? []) as NoticeRow[];
  const planned = open.map((row) => ({
    row,
    plan: planDeletionNotice({
      today,
      deleteOn: row.delete_on,
      sent14: Boolean(row.notice_14_sent_at),
      sent3On: row.notice_3_sent_at ? londonDateIso(new Date(row.notice_3_sent_at)) : null,
    }),
  }));

  const labels = await labelsFor(
    admin,
    planned.filter((item) => item.plan.action === "send14" || item.plan.action === "send3").map((item) => item.row)
  );

  let emailError: string | null = null;
  let sent14 = 0;
  let sent3 = 0;
  for (const action of ["send14", "send3"] as const) {
    const batch = planned.filter((item) => item.plan.action === action);
    const byDate = new Map<string, typeof batch>();
    for (const item of batch) {
      const deleteOn = item.plan.deleteOn;
      if (!deleteOn) continue;
      const list = byDate.get(deleteOn) ?? [];
      list.push(item);
      byDate.set(deleteOn, list);
    }
    for (const [deleteOn, items] of byDate) {
      const sent = await sendDeletionNoticeEmail({
        daysAhead: action === "send14" ? 14 : 3,
        deleteOnLabel: formatDeletionDate(deleteOn),
        people: groupPeople(items.map((item) => item.row), labels),
      });
      if (sent.error) {
        emailError = sent.error;
        console.error("[data-cleanup] deletion notice email failed", sent.error);
        continue;
      }
      for (const item of items) {
        const stamp = action === "send14" ? { notice_14_sent_at: now.toISOString() } : { notice_3_sent_at: now.toISOString() };
        const { error } = await admin
          .from("data_deletion_notices")
          .update({
            ...stamp,
            delete_on: deleteOn,
            subject_label: labels.get(fileKey(item.row)) ?? item.row.subject_label,
          })
          .eq("id", item.row.id);
        if (error) emailError = error.message;
      }
      if (action === "send14") sent14 += items.length;
      else sent3 += items.length;
    }
  }

  const due = planned
    .filter((item) => item.plan.action === "delete" && orphanKeys.has(fileKey(item.row)))
    .map((item) => ({ bucket: item.row.bucket, path: item.row.path }));

  return { due, emailError, sent14, sent3 };
}

export async function markNoticesDeleted(admin: SupabaseClient, files: StorageRef[], now = new Date()) {
  if (files.length === 0) return;
  for (const file of files) {
    await admin
      .from("data_deletion_notices")
      .update({ deleted_at: now.toISOString() })
      .eq("bucket", file.bucket)
      .eq("path", file.path)
      .is("deleted_at", null);
  }
}

function fileKey(file: { bucket: string; path: string }): string {
  return `${file.bucket}/${file.path}`;
}

function groupPeople(rows: NoticeRow[], labels: Map<string, string>): DeletionNoticePerson[] {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const label = labels.get(fileKey(row)) ?? row.subject_label ?? "No account linked";
    const files = grouped.get(label) ?? [];
    files.push(fileKey(row));
    grouped.set(label, files);
  }
  return [...grouped.entries()].map(([label, files]) => ({ label, files }));
}

async function labelsFor(admin: SupabaseClient, rows: NoticeRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => row.path.split("/").filter((part) => UUID_RE.test(part))))];
  const profiles = new Map<string, { name: string }>();
  const kids = new Map<string, KidRow>();
  if (ids.length > 0) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", ids);
    for (const row of (profileRows ?? []) as ProfileRow[]) {
      profiles.set(row.id, { name: row.preferred_name?.trim() || row.full_name?.trim() || "Unknown" });
    }
    const { data: kidRows } = await admin
      .from("kid_profiles")
      .select("id, name, parent_user_id")
      .in("id", ids);
    const parentIds = new Set<string>();
    for (const row of (kidRows ?? []) as KidRow[]) {
      kids.set(row.id, row);
      if (!profiles.has(row.parent_user_id)) parentIds.add(row.parent_user_id);
    }
    if (parentIds.size > 0) {
      const { data: parents } = await admin
        .from("profiles")
        .select("id, full_name, preferred_name")
        .in("id", [...parentIds]);
      for (const row of (parents ?? []) as ProfileRow[]) {
        profiles.set(row.id, { name: row.preferred_name?.trim() || row.full_name?.trim() || "Unknown" });
      }
    }
  }

  const emails = new Map<string, string>();
  for (const userId of profiles.keys()) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.email) emails.set(userId, data.user.email);
  }

  const labels = new Map<string, string>();
  for (const row of rows) {
    const parts = row.path.split("/").filter((part) => UUID_RE.test(part));
    const kid = parts.map((id) => kids.get(id)).find(Boolean);
    if (kid) {
      const parent = profiles.get(kid.parent_user_id);
      const parentEmail = emails.get(kid.parent_user_id);
      const parentLabel = parent
        ? `${parent.name}${parentEmail ? ` <${parentEmail}>` : ""}`
        : "unknown parent";
      labels.set(fileKey(row), `${kid.name}, child profile of ${parentLabel}`);
      continue;
    }
    const userId = parts.find((id) => profiles.has(id));
    if (userId) {
      const profile = profiles.get(userId)!;
      const email = emails.get(userId);
      labels.set(fileKey(row), email ? `${profile.name} <${email}>` : profile.name);
      continue;
    }
    labels.set(fileKey(row), "No account linked");
  }
  return labels;
}
