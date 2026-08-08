"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  dedupeTargetsByTile,
  resolveLearnTourTileId,
  sortCourseTourTargets,
  type CourseTourTarget,
} from "@/lib/tours/course-tile";
import { isAdmin } from "@/lib/auth/admin";

export type TourBootstrap = {
  hasSeenAppTour: boolean;
  hasSeenOnboarding: boolean;
  pendingCourseTours: CourseTourTarget[];
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null };
  return { supabase, user };
}

export async function loadPendingCourseResourceTours(
  userId: string
): Promise<CourseTourTarget[]> {
  const supabase = await createClient();

  const [{ data: accessRows }, { data: seenRows }, { data: courses }] =
    await Promise.all([
      supabase
        .from("course_access")
        .select("course_id, granted_at")
        .eq("user_id", userId)
        .order("granted_at", { ascending: true }),
      supabase
        .from("course_resource_tours_seen")
        .select("course_id")
        .eq("user_id", userId),
      supabase
        .from("courses")
        .select("id, name, required_tier, is_public, content_track, is_home_course"),
    ]);

  const seen = new Set((seenRows ?? []).map((row) => row.course_id as string));
  const courseById = new Map(
    (courses ?? []).map((course) => [course.id as string, course])
  );

  const targets: CourseTourTarget[] = [];
  for (const row of accessRows ?? []) {
    const courseId = row.course_id as string;
    if (seen.has(courseId)) continue;
    const course = courseById.get(courseId);
    if (!course) continue;
    // Learn-tab English courses aren't Punjabi Learn hub tiles — don't queue tours for them.
    if (
      course.content_track === "learn_english" &&
      course.is_home_course === false
    ) {
      continue;
    }
    const tileId = resolveLearnTourTileId({
      id: course.id as string,
      name: course.name as string,
      required_tier: course.required_tier as string | null,
      is_public: course.is_public as boolean | null,
    });
    if (!tileId) continue;
    // Resource tour is for paid Learn tracks + private English — skip free-only noise.
    targets.push({
      courseId,
      courseName: (course.name as string) || "your course",
      tileId,
    });
  }

  return sortCourseTourTargets(targets);
}

/** Preview: all course_access targets, ignoring tours_seen. One spotlight per Learn tile. */
export async function loadPreviewCourseResourceTours(): Promise<{
  targets: CourseTourTarget[];
  emptyReason?: string;
}> {
  const { supabase, user } = await requireUser();
  if (!user) return { targets: [], emptyReason: "Not signed in." };
  if (!isAdmin(user)) return { targets: [], emptyReason: "Admin only." };

  const [{ data: accessRows }, { data: courses }] = await Promise.all([
    supabase
      .from("course_access")
      .select("course_id, granted_at")
      .eq("user_id", user.id)
      .order("granted_at", { ascending: true }),
    supabase.from("courses").select("id, name, required_tier, is_public, content_track, is_home_course"),
  ]);

  if (!accessRows?.length) {
    return { targets: [], emptyReason: "No courses to preview." };
  }

  const courseById = new Map(
    (courses ?? []).map((course) => [course.id as string, course])
  );

  const targets: CourseTourTarget[] = [];
  for (const row of accessRows) {
    const courseId = row.course_id as string;
    const course = courseById.get(courseId);
    if (!course) continue;
    if (
      course.content_track === "learn_english" &&
      course.is_home_course === false
    ) {
      continue;
    }
    const tileId = resolveLearnTourTileId({
      id: course.id as string,
      name: course.name as string,
      required_tier: course.required_tier as string | null,
      is_public: course.is_public as boolean | null,
    });
    if (!tileId) continue;
    targets.push({
      courseId,
      courseName: (course.name as string) || "your course",
      tileId,
    });
  }

  const sorted = sortCourseTourTargets(targets);
  const deduped = dedupeTargetsByTile(sorted);
  if (deduped.length === 0) {
    return { targets: [], emptyReason: "No courses to preview." };
  }
  return { targets: deduped };
}

export async function markAppTourSeen(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ has_seen_app_tour: true })
    .eq("id", user.id);

  if (error) return { error: error.message };
  // Do not revalidate here — a layout refresh mid Part-1→Part-2 sequence
  // remounts TourProvider and can drop course-tour persistence.
  return {};
}

export async function markCourseResourceTourSeen(
  courseId: string
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!courseId) return { error: "Missing course." };

  const { error } = await supabase.from("course_resource_tours_seen").insert({
    user_id: user.id,
    course_id: courseId,
    shown_at: new Date().toISOString(),
  });

  // Ignore duplicate PK (already marked).
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { error: error.message };
  }
  return {};
}

export async function resetTourFlags(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Not signed in." };
  if (!isAdmin(user)) return { error: "Admin only." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ has_seen_app_tour: false })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  // course_resource_tours_seen RLS is select/insert only — delete via service role.
  const { tryCreateServiceRoleClient } = await import(
    "@/lib/supabase/admin-server"
  );
  const admin = tryCreateServiceRoleClient();
  if (admin.error || !admin.client) {
    return { error: admin.error ?? "Service role unavailable for tour reset." };
  }

  const { error: deleteError } = await admin.client
    .from("course_resource_tours_seen")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/dashboard", "layout");
  return {};
}
