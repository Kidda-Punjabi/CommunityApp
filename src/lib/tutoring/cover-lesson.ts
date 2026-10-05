import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CoverTutorChoice = {
  id: string;
  name: string;
  notionLinked: boolean;
};

export function defaultCoverTeacherId(input: {
  loggedInUserId: string;
  assignedTutorId: string | null;
}): string {
  if (input.assignedTutorId && input.assignedTutorId !== input.loggedInUserId) {
    return input.loggedInUserId;
  }
  return "";
}

export function coverTaughtByLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? `Cover · taught by ${trimmed}` : "Cover lesson";
}

/** Cover lessons count for the tutor who taught them. Other lessons count for the assigned tutor. */
export function lessonCountsAsTaughtBy(input: {
  tutorId: string;
  classTutorId: string | null;
  isCoverSession: boolean;
  actualTutorId: string | null;
}): boolean {
  if (input.isCoverSession) return input.actualTutorId === input.tutorId;
  return input.classTutorId === input.tutorId;
}

export async function resolveCoverLessonWrite(
  admin: SupabaseClient,
  input: { isCoverSession?: boolean; actualTutorId?: string | null }
): Promise<
  | {
      ok: true;
      isCoverSession: boolean;
      actualTutorId: string | null;
      notionTutorUserId: string | null;
    }
  | { ok: false; error: string }
> {
  if (!input.isCoverSession) {
    return {
      ok: true,
      isCoverSession: false,
      actualTutorId: null,
      notionTutorUserId: null,
    };
  }

  const tutorId = input.actualTutorId?.trim() ?? "";
  if (!tutorId) return { ok: false, error: "Choose who taught this lesson." };

  const [{ data: profile }, { data: roles }, { data: map }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, preferred_name")
      .eq("id", tutorId)
      .maybeSingle(),
    admin
      .from("profile_roles")
      .select("role")
      .eq("user_id", tutorId)
      .in("role", ["tutor", "master_admin"]),
    admin.from("notion_tutor_map").select("notion_user_id").eq("tutor_id", tutorId).maybeSingle(),
  ]);

  if (!profile || (roles ?? []).length === 0) {
    return { ok: false, error: "Choose an active tutor." };
  }

  const notionUserId = ((map?.notion_user_id as string | null) ?? "").trim();
  if (!notionUserId) {
    const name = getDisplayName(profile) || "That tutor";
    return {
      ok: false,
      error: `${name} is not linked to a Notion tutor profile, so this cover lesson cannot be saved.`,
    };
  }

  return {
    ok: true,
    isCoverSession: true,
    actualTutorId: tutorId,
    notionTutorUserId: notionUserId,
  };
}
