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
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("id, course_id, is_free")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) throw error;
  if (!lesson) return false;

  if (await canAccessAdminPanel(user, supabase)) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("course_id", lesson.course_id)
      .maybeSingle();

    // Staff enrolled as students follow the same unlock rules as everyone else.
    if (!enrollment) return true;
  }

  const unlockMap = await fetchLessonContentUnlockMap(
    supabase,
    user.id,
    [{ id: lesson.id, course_id: lesson.course_id, is_free: lesson.is_free }],
    access
  );

  return unlockMap.get(lessonId) ?? false;
}
