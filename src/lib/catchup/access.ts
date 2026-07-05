import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import type { CourseAccessContext } from "@/lib/membership/unlocked";
import {
  fetchLessonContentUnlockMap,
} from "@/lib/tutoring/lesson-content-access";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function canAccessCatchupLesson(
  supabase: SupabaseClient,
  user: User,
  lessonId: string,
  access: CourseAccessContext
): Promise<boolean> {
  if (await canAccessAdminPanel(user, supabase)) {
    return true;
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, is_free")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) throw error;
  if (!lesson) return false;

  const unlockMap = await fetchLessonContentUnlockMap(
    supabase,
    user.id,
    [{ id: lesson.id, course_id: lesson.course_id, is_free: lesson.is_free }],
    access
  );

  return unlockMap.get(lessonId) ?? false;
}
