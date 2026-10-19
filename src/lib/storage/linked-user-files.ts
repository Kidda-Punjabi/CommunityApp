import "server-only";

import { feedbackPhotoObjectPath } from "@/lib/storage/feedback-photo-path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageRef = { bucket: string; path: string };

const REMOVE_BATCH = 100;

export async function removeStorageRefs(
  admin: SupabaseClient,
  files: StorageRef[]
): Promise<{ removed: number; errors: Array<{ bucket: string; path: string; message: string }> }> {
  const grouped = new Map<string, Set<string>>();
  for (const file of files) {
    const path = file.path.trim();
    if (!file.bucket || !path) continue;
    const paths = grouped.get(file.bucket) ?? new Set<string>();
    paths.add(path);
    grouped.set(file.bucket, paths);
  }

  let removed = 0;
  const errors: Array<{ bucket: string; path: string; message: string }> = [];

  for (const [bucket, paths] of grouped) {
    const names = [...paths];
    for (let index = 0; index < names.length; index += REMOVE_BATCH) {
      const batch = names.slice(index, index + REMOVE_BATCH);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (!error) {
        removed += batch.length;
        continue;
      }
      for (const path of batch) {
        const single = await admin.storage.from(bucket).remove([path]);
        if (single.error) {
          errors.push({ bucket, path, message: single.error.message });
        } else {
          removed += 1;
        }
      }
    }
  }

  return { removed, errors };
}

export async function collectKidStorageFiles(
  admin: SupabaseClient,
  kidProfileId: string
): Promise<StorageRef[]> {
  const files: StorageRef[] = [];

  const { data: homework, error: homeworkError } = await admin
    .from("homework_submissions")
    .select("storage_path, tutor_feedback_audio_path")
    .eq("kid_profile_id", kidProfileId);
  if (homeworkError) {
    console.error("[kid-profile-delete] homework paths failed", homeworkError.message);
  }
  for (const row of homework ?? []) {
    if (row.storage_path) files.push({ bucket: "homework-recordings", path: row.storage_path });
    if (row.tutor_feedback_audio_path) {
      files.push({ bucket: "homework-recordings", path: row.tutor_feedback_audio_path });
    }
  }

  const { data: photos, error: photoError } = await admin
    .from("feedback_submissions")
    .select("picture_url")
    .eq("kid_profile_id", kidProfileId);
  if (photoError) {
    console.error("[kid-profile-delete] photo paths failed", photoError.message);
  }
  for (const row of photos ?? []) {
    const path = feedbackPhotoObjectPath(row.picture_url as string | null);
    if (path) files.push({ bucket: "feedback-photos", path });
  }

  const listed = await admin.rpc("list_storage_objects_for_kid", { target: kidProfileId });
  if (listed.error) {
    console.error("[kid-profile-delete] kid storage list failed", listed.error.message);
  } else {
    for (const row of (listed.data ?? []) as Array<{ bucket_id: string; name: string }>) {
      files.push({ bucket: row.bucket_id, path: row.name });
    }
  }

  return files;
}

export async function collectFeedbackPhotoFiles(
  admin: SupabaseClient,
  userId: string,
  kidIds: string[]
): Promise<StorageRef[]> {
  const files: StorageRef[] = [];

  const own = await admin.from("feedback_submissions").select("picture_url").eq("user_id", userId);
  if (own.error) {
    console.error("[account-delete] feedback photo paths failed", own.error.message);
  }
  for (const row of own.data ?? []) {
    const path = feedbackPhotoObjectPath(row.picture_url as string | null);
    if (path) files.push({ bucket: "feedback-photos", path });
  }

  if (kidIds.length === 0) return files;

  const kids = await admin
    .from("feedback_submissions")
    .select("picture_url")
    .in("kid_profile_id", kidIds);
  if (kids.error) {
    console.error("[account-delete] kid feedback photo paths failed", kids.error.message);
  }
  for (const row of kids.data ?? []) {
    const path = feedbackPhotoObjectPath(row.picture_url as string | null);
    if (path) files.push({ bucket: "feedback-photos", path });
  }

  return files;
}
