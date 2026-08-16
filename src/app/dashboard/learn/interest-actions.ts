"use server";

import { isComingSoonCourseLevel } from "@/lib/learn/course-interest";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function registerCourseInterest(
  courseLevel: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isComingSoonCourseLevel(courseLevel)) {
    return { ok: false, error: "That course is not open for interest yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("course_interest_signups").upsert(
    {
      user_id: user.id,
      course_level: courseLevel,
    },
    { onConflict: "user_id,course_level", ignoreDuplicates: true }
  );

  if (error) {
    console.error("registerCourseInterest:", error.message);
    return { ok: false, error: "Could not register interest. Try again." };
  }

  revalidatePath("/dashboard/learn");
  revalidatePath(`/dashboard/learn/courses/${courseLevel}`);
  revalidatePath("/admin/content/people/interest");
  return { ok: true };
}
