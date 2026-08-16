"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { loadCourseInterestSignups, type CourseInterestSignup } from "@/lib/learn/course-interest";

export async function loadAdminCourseInterest(): Promise<{
  signups: CourseInterestSignup[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    const signups = await loadCourseInterestSignups(supabase);
    return { signups };
  } catch (e) {
    return {
      signups: [],
      error: e instanceof Error ? e.message : "Could not load course interest.",
    };
  }
}
