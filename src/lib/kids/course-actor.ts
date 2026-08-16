import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseActor =
  | { kind: "user"; userId: string; kidProfileId: null }
  | { kind: "kid"; userId: string; kidProfileId: string };

/**
 * Resolve the active course actor from kid_session_context.
 * Never uses a client-supplied kid_profile_id — only the server session row,
 * verified against kid_profiles.parent_user_id.
 */
export async function resolveCourseActor(
  supabase: SupabaseClient,
  parentUserId: string
): Promise<CourseActor> {
  const { data: context } = await supabase
    .from("kid_session_context")
    .select("active_kid_profile_id")
    .eq("user_id", parentUserId)
    .maybeSingle();

  const kidProfileId = context?.active_kid_profile_id as string | null | undefined;
  if (!kidProfileId) {
    return { kind: "user", userId: parentUserId, kidProfileId: null };
  }

  const { data: kid } = await supabase
    .from("kid_profiles")
    .select("id")
    .eq("id", kidProfileId)
    .eq("parent_user_id", parentUserId)
    .maybeSingle();

  if (!kid?.id) {
    return { kind: "user", userId: parentUserId, kidProfileId: null };
  }

  return { kind: "kid", userId: parentUserId, kidProfileId: kid.id };
}

export function actorFilter(
  actor: CourseActor
): { column: "user_id" | "student_id" | "kid_profile_id"; value: string } {
  if (actor.kind === "kid") {
    return { column: "kid_profile_id", value: actor.kidProfileId };
  }
  return { column: "user_id", value: actor.userId };
}

export function studentActorFilter(
  actor: CourseActor
): { column: "student_id" | "kid_profile_id"; value: string } {
  if (actor.kind === "kid") {
    return { column: "kid_profile_id", value: actor.kidProfileId };
  }
  return { column: "student_id", value: actor.userId };
}

export function lessonProgressWrite(
  actor: CourseActor,
  rest: Record<string, unknown>
): Record<string, unknown> {
  if (actor.kind === "kid") {
    return { ...rest, user_id: null, kid_profile_id: actor.kidProfileId };
  }
  return { ...rest, user_id: actor.userId, kid_profile_id: null };
}

export function quizProgressWrite(
  actor: CourseActor,
  rest: Record<string, unknown>
): Record<string, unknown> {
  return lessonProgressWrite(actor, rest);
}

export function homeworkWrite(
  actor: CourseActor,
  rest: Record<string, unknown>
): Record<string, unknown> {
  if (actor.kind === "kid") {
    return { ...rest, student_id: null, kid_profile_id: actor.kidProfileId };
  }
  return { ...rest, student_id: actor.userId, kid_profile_id: null };
}
