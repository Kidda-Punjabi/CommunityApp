import "server-only";

import { collectFeedbackPhotoFiles, removeStorageRefs } from "@/lib/storage/linked-user-files";
import type { createServiceRoleClient } from "@/lib/supabase/admin-server";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function removeStorageObjects(
  admin: AdminClient,
  userId: string,
  extra: Array<{ bucket: string; path: string }>
) {
  const grouped = new Map<string, Set<string>>();
  function add(bucket: string, path: string) {
    const name = path.trim();
    if (!bucket || !name) return;
    const paths = grouped.get(bucket) ?? new Set<string>();
    paths.add(name);
    grouped.set(bucket, paths);
  }

  const listed = await admin.rpc("list_storage_objects_for_user", { target: userId });
  if (!listed.error) {
    for (const row of (listed.data ?? []) as Array<{ bucket_id: string; name: string }>) {
      add(row.bucket_id, row.name);
    }
  }

  for (const item of extra) add(item.bucket, item.path);

  const { data: avatars } = await admin.storage.from("avatars").list(userId);
  for (const file of avatars ?? []) {
    if (file.name) add("avatars", `${userId}/${file.name}`);
  }

  const files = [...grouped.entries()].flatMap(([bucket, paths]) =>
    [...paths].map((path) => ({ bucket, path }))
  );
  const removed = await removeStorageRefs(admin, files);
  if (removed.errors.length > 0) {
    console.error("[account-delete] storage remove failed", removed.errors.length);
  }
}

/** Removes this account's files, including tutor notes on the parent's and kids' homework. */
export async function purgeAccountStorage(admin: AdminClient, userId: string): Promise<void> {
  const { data: kidRows } = await admin.from("kid_profiles").select("id").eq("parent_user_id", userId);
  const kidIds = (kidRows ?? []).map((row) => row.id as string);

  const extraFiles: Array<{ bucket: string; path: string }> = [];
  const { data: homework } = await admin
    .from("homework_submissions")
    .select("storage_path, tutor_feedback_audio_path")
    .eq("student_id", userId);
  for (const row of homework ?? []) {
    if (row.storage_path) extraFiles.push({ bucket: "homework-recordings", path: row.storage_path });
    if (row.tutor_feedback_audio_path) {
      extraFiles.push({ bucket: "homework-recordings", path: row.tutor_feedback_audio_path });
    }
  }
  if (kidIds.length > 0) {
    const { data: kidHomework } = await admin
      .from("homework_submissions")
      .select("storage_path, tutor_feedback_audio_path")
      .in("kid_profile_id", kidIds);
    for (const row of kidHomework ?? []) {
      if (row.storage_path) extraFiles.push({ bucket: "homework-recordings", path: row.storage_path });
      if (row.tutor_feedback_audio_path) {
        extraFiles.push({ bucket: "homework-recordings", path: row.tutor_feedback_audio_path });
      }
    }
  }
  const { data: discounts } = await admin
    .from("student_discount_requests")
    .select("storage_path")
    .eq("user_id", userId);
  for (const row of discounts ?? []) {
    if (row.storage_path) {
      extraFiles.push({ bucket: "student-discount-evidence", path: row.storage_path });
    }
  }
  extraFiles.push(...(await collectFeedbackPhotoFiles(admin, userId, kidIds)));
  await removeStorageObjects(admin, userId, extraFiles);
}
