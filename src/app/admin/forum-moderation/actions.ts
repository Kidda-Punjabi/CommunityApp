"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function adminUserId(): Promise<string> {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user.id;
}

export async function moderateForumItem(input: {
  targetType: "post" | "reply";
  targetId: string;
  action: "dismiss" | "remove" | "suspend";
  suspendFor: "7" | "30" | "permanent" | null;
  reason: string;
}): Promise<{ error?: string; success?: string }> {
  const admin = await requireAdminFromActions();
  const reviewerId = await adminUserId();
  const table = input.targetType === "post" ? "forum_posts" : "forum_replies";
  const { data: item } = await admin
    .from(table)
    .select("id, author_id, status")
    .eq("id", input.targetId)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const now = new Date().toISOString();
  let actionTaken = "dismissed";
  if (input.action === "dismiss") {
    if (item.status === "hidden_pending_review") {
      const { error } = await admin.from(table).update({ status: "visible" }).eq("id", item.id);
      if (error) return { error: error.message };
    }
    actionTaken = "dismissed";
  } else {
    const { error } = await admin.from(table).update({ status: "deleted" }).eq("id", item.id);
    if (error) return { error: error.message };
    actionTaken = input.action === "suspend" ? `removed_and_suspended_${input.suspendFor ?? "permanent"}` : "removed";
  }

  const reportColumn = input.targetType === "post" ? "post_id" : "reply_id";
  const { error: reportError } = await admin
    .from("forum_reports")
    .update({
      status: input.action === "dismiss" ? "dismissed" : "actioned",
      reviewed_at: now,
      reviewed_by: reviewerId,
      action_taken: actionTaken,
    })
    .eq(reportColumn, input.targetId)
    .eq("status", "open");
  if (reportError) return { error: reportError.message };

  if (input.action === "suspend") {
    const reason = input.reason.trim();
    if (!reason) return { error: "A suspension needs a reason." };
    const until =
      input.suspendFor === "7"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : input.suspendFor === "30"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;
    const { error } = await admin.from("forum_user_suspensions").insert({
      user_id: item.author_id,
      reason,
      suspended_until: until,
      created_by: reviewerId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/forum-moderation");
  revalidatePath("/dashboard/community/forum");
  return { success: "Saved." };
}

export async function addBlockedTerm(formData: FormData): Promise<void> {
  const admin = await requireAdminFromActions();
  const reviewerId = await adminUserId();
  const term = String(formData.get("term") ?? "").trim().toLowerCase();
  if (!term) return;
  await admin.from("forum_blocked_terms").insert({
    term,
    created_by: reviewerId,
  });
  revalidatePath("/admin/forum-moderation/words");
}

export async function removeBlockedTerm(formData: FormData): Promise<void> {
  const admin = await requireAdminFromActions();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) return;
  await admin.from("forum_blocked_terms").delete().eq("id", termId);
  revalidatePath("/admin/forum-moderation/words");
}
