"use server";

import { revalidatePath } from "next/cache";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import type { UnresolvedEnrollmentRow } from "@/lib/admin/unresolved-enrollments/types";
import { addLeadToCohortConfirmedInNotion } from "@/lib/notion/cohort-notion-writeback";
import { setNotionLeadAppUserId } from "@/lib/notion/lead-sync";
import { createClient } from "@/lib/supabase/server";

export type UnresolvedEnrollmentAction =
  | "enroll"
  | "repair"
  | "link_and_enroll"
  | "add_to_notion"
  | "remove_member"
  | "dismiss"
  | "not_using_app"
  | "merge";

export async function fetchUnresolvedEnrollments(): Promise<{
  rows: UnresolvedEnrollmentRow[];
  error?: string;
}> {
  const supabase = await requireAdminFromActions();
  const { data, error } = await supabase.rpc("admin_unresolved_enrollment_rows");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as UnresolvedEnrollmentRow[] };
}

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "That action failed.";
}

export async function resolveUnresolvedEnrollment(input: {
  action: UnresolvedEnrollmentAction;
  targetKind: "cohort" | "package_instance";
  targetId: string;
  userId: string | null;
  notionLeadPageId: string | null;
  notionPackagePageId: string | null;
  kidProfileId: string | null;
  note: string | null;
}): Promise<{ error?: string }> {
  if (input.action === "merge") {
    return {
      error: "Merge is not available yet. Confirm which account to keep before this can run.",
    };
  }

  const supabase = await requireAdminFromActions();
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const sqlAction: "enroll" | "repair" | "cache_confirmed" | "remove_member" | "dismiss" | "not_using_app" =
    input.action === "link_and_enroll"
      ? "enroll"
      : input.action === "add_to_notion"
        ? "cache_confirmed"
        : input.action;

  try {
    if (input.action === "link_and_enroll") {
      if (!input.notionLeadPageId || !input.userId) {
        return { error: "A Notion lead and an app account are required to link App User ID." };
      }
      await setNotionLeadAppUserId(input.notionLeadPageId, input.userId);
    }
    if (input.action === "add_to_notion") {
      if (!input.notionPackagePageId || !input.notionLeadPageId) {
        return { error: "This row has no Notion package or lead to update." };
      }
      await addLeadToCohortConfirmedInNotion(input.notionPackagePageId, input.notionLeadPageId);
    }
  } catch (error) {
    return { error: messageFrom(error) };
  }

  const { error } = await supabase.rpc("admin_resolve_unresolved_enrollment", {
    p_actor: user.id,
    p_action: sqlAction,
    p_target_kind: input.targetKind,
    p_target_id: input.targetId,
    p_user_id: input.userId,
    p_notion_lead_page_id: input.notionLeadPageId,
    p_kid_profile_id: input.kidProfileId,
    p_note: input.note,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/unresolved-enrollments");
  return {};
}
