import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { LESSON_LOG_MEDIA_BUCKET, publicStorageObjectUrl } from "@/lib/storage/signed-media";

type LogMediaRow = {
  cohort_id: string | null;
  package_instance_id: string | null;
};

export async function canReadLessonLogMedia(
  user: User,
  userClient: SupabaseClient,
  admin: SupabaseClient,
  objectPath: string
): Promise<boolean> {
  if (await canAccessAdminPanel(user, userClient)) return true;

  const urls = publicStorageObjectUrl(LESSON_LOG_MEDIA_BUCKET, objectPath);
  if (urls.length === 0) return false;

  const { data: recordings } = await admin
    .from("lesson_recordings")
    .select("id, cohort_id, student_id, lesson_id")
    .in("storage_path", urls);

  for (const rec of recordings ?? []) {
    const { data: viewable } = await admin.rpc("can_view_lesson_recording", {
      p_user_id: user.id,
      p_recording_id: rec.id,
    });
    if (viewable) return true;

    if (rec.cohort_id) {
      const { data: manage } = await userClient.rpc("tutor_can_manage_cohort", {
        p_cohort_id: rec.cohort_id,
      });
      if (manage) return true;
    }

    if (rec.student_id && rec.lesson_id) {
      const { data: teaches } = await admin.rpc("tutor_teaches_student_for_lesson", {
        p_tutor_id: user.id,
        p_student_id: rec.student_id,
        p_lesson_id: rec.lesson_id,
      });
      if (teaches) return true;
    }
  }

  const logRows = await loadMatchingLessonLogRows(admin, urls);
  if (logRows.length === 0) return false;

  const { data: kidId } = await admin.rpc("active_kid_profile_id_for", {
    p_user_id: user.id,
  });

  for (const row of logRows) {
    if (row.cohort_id) {
      const { data: manage } = await userClient.rpc("tutor_can_manage_cohort", {
        p_cohort_id: row.cohort_id,
      });
      if (manage) return true;

      const { data: asUser } = await admin
        .from("cohort_members")
        .select("id")
        .eq("cohort_id", row.cohort_id)
        .eq("user_id", user.id)
        .is("left_at", null)
        .limit(1)
        .maybeSingle();
      if (asUser) return true;

      if (kidId) {
        const { data: asKid } = await admin
          .from("cohort_members")
          .select("id")
          .eq("cohort_id", row.cohort_id)
          .eq("kid_profile_id", kidId)
          .is("left_at", null)
          .limit(1)
          .maybeSingle();
        if (asKid) return true;
      }
    }

    if (row.package_instance_id) {
      const { data: pkg } = await admin
        .from("package_instances")
        .select("tutor_id")
        .eq("id", row.package_instance_id)
        .maybeSingle();
      if (pkg?.tutor_id === user.id) return true;
    }
  }

  return false;
}

async function loadMatchingLessonLogRows(
  admin: SupabaseClient,
  urls: string[]
): Promise<LogMediaRow[]> {
  const [recording, slides, flashcards] = await Promise.all([
    admin
      .from("cohort_lesson_log_entries")
      .select("cohort_id, package_instance_id")
      .in("recording_url", urls),
    admin
      .from("cohort_lesson_log_entries")
      .select("cohort_id, package_instance_id")
      .in("slides_url", urls),
    admin
      .from("cohort_lesson_log_entries")
      .select("cohort_id, package_instance_id")
      .in("flashcards_url", urls),
  ]);

  return [
    ...(recording.data ?? []),
    ...(slides.data ?? []),
    ...(flashcards.data ?? []),
  ];
}
