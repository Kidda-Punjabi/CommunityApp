"use server";

import {
  canAccessForum,
  canModerateForum,
  loadForumGuidelinesAgreement,
} from "@/lib/forum/access";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ForumActionResult = { error?: string; success?: string };

type ForumSession =
  | { ok: false; result: ForumActionResult }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

async function requireForumMember(): Promise<ForumSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, result: { error: "You must be signed in." } };
  if (!(await canAccessForum(supabase, user.id))) {
    return { ok: false, result: { error: "Community forum is for active members only." } };
  }

  return { ok: true, supabase, userId: user.id };
}

export async function agreeToForumGuidelines(
  _prev: ForumActionResult,
  _formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const { error } = await supabase
    .from("profiles")
    .update({ has_agreed_forum_guidelines: true })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community/forum/guidelines");
  return { success: "Thanks — you can now post in the forum." };
}

export async function createForumPost(
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const agreed = await loadForumGuidelinesAgreement(supabase, userId);
  if (!agreed) {
    return { error: "Please read and accept the community guidelines first." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!title || !body) return { error: "Title and message are required." };

  const { error } = await supabase.from("forum_posts").insert({
    author_id: userId,
    title,
    body,
    category,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/community/forum");
  return { success: "Post published." };
}

export async function createForumReply(
  postId: string,
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Reply cannot be empty." };

  const { supabase, userId } = session;
  const { error } = await supabase.from("forum_replies").insert({
    post_id: postId,
    author_id: userId,
    body,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/community/forum/${postId}`);
  revalidatePath("/dashboard/community/forum");
  return { success: "Reply posted." };
}

export async function toggleForumPostLike(postId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const { data: existing } = await supabase
    .from("forum_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("forum_likes").delete().eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("forum_likes").insert({
      user_id: userId,
      post_id: postId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/community/forum/${postId}`);
  revalidatePath("/dashboard/community/forum");
  return { success: "Updated." };
}

export async function toggleForumReplyLike(replyId: string, postId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const { data: existing } = await supabase
    .from("forum_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("reply_id", replyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("forum_likes").delete().eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("forum_likes").insert({
      user_id: userId,
      reply_id: replyId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/community/forum/${postId}`);
  return { success: "Updated." };
}

export async function reportForumContent(
  targetType: "post" | "reply",
  targetId: string,
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Please describe why you are reporting this." };

  const { supabase, userId } = session;
  const { error } = await supabase.from("forum_reports").insert({
    reporter_id: userId,
    post_id: targetType === "post" ? targetId : null,
    reply_id: targetType === "reply" ? targetId : null,
    reason,
  });

  if (error) return { error: error.message };

  return { success: "Report submitted. Our team will review it." };
}

export async function moderateForumContent(
  targetType: "post" | "reply",
  targetId: string,
  action: "hide" | "remove"
): Promise<ForumActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };
  if (!(await canModerateForum(supabase, user.id))) {
    return { error: "You do not have permission to moderate the forum." };
  }

  const status = action === "hide" ? "hidden" : "removed";
  const table = targetType === "post" ? "forum_posts" : "forum_replies";

  const { error: contentError } = await supabase
    .from(table)
    .update({ status })
    .eq("id", targetId);

  if (contentError) return { error: contentError.message };

  const reportFilter =
    targetType === "post" ? { post_id: targetId } : { reply_id: targetId };

  await supabase
    .from("forum_reports")
    .update({ status: "resolved" })
    .match({ ...reportFilter, status: "open" });

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community/forum/moderation");
  revalidatePath("/admin/content/site");
  if (targetType === "post") {
    revalidatePath(`/dashboard/community/forum/${targetId}`);
  }

  return { success: action === "hide" ? "Content hidden." : "Content removed." };
}
