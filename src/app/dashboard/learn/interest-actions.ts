"use server";

import { isComingSoonCourseLevel } from "@/lib/learn/course-interest";
import { resolveCourseActor } from "@/lib/kids/course-actor";
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

  const actor = await resolveCourseActor(supabase, user.id);
  const isKidLevel = courseLevel === "kids_intermediate" || courseLevel === "kids_advanced";
  if (isKidLevel && actor.kind !== "kid") {
    return { ok: false, error: "Switch to a kid profile to register interest." };
  }
  if (!isKidLevel && actor.kind === "kid") {
    return { ok: false, error: "That course is not open for this profile." };
  }

  const { error } = await supabase.from("course_interest_signups").insert(
    actor.kind === "kid"
      ? {
          user_id: null,
          kid_profile_id: actor.kidProfileId,
          course_level: courseLevel,
        }
      : {
          user_id: user.id,
          kid_profile_id: null,
          course_level: courseLevel,
        }
  );

  if (error && error.code !== "23505") {
    console.error("registerCourseInterest:", error.message);
    return { ok: false, error: "Could not register interest. Try again." };
  }

  revalidatePath("/dashboard/learn");
  revalidatePath(`/dashboard/learn/courses/${courseLevel}`);
  revalidatePath("/admin/content/people/interest");
  return { ok: true };
}
