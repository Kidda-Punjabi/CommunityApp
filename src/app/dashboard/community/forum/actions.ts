"use server";

import { isMasterAdmin } from "@/lib/auth/admin-access";
import {
  canAccessForum,
  canModerateForum,
  FORUM_INTRO_CATEGORY,
  loadForumGuidelinesAgreement,
  loadForumOnboardingState,
} from "@/lib/forum/access";
import {
  FORUM_LANGUAGE_MESSAGE,
  FORUM_REPORT_REASONS,
  FORUM_REPORT_THANKS,
  FORUM_SUSPENDED_MESSAGE,
  forumLanguageError,
  type ForumReportReason,
} from "@/lib/forum/safety";
import { deliverForumReportEmail } from "@/lib/forum/deliver-forum-report-email";
import { getDisplayName } from "@/lib/profile/display-name";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ForumActionResult = {
  error?: string;
  success?: string;
  needsRules?: boolean;
  reportId?: string;
};

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

function friendlyForumError(message: string | undefined): string {
  if (forumLanguageError(message)) return FORUM_LANGUAGE_MESSAGE;
  if ((message ?? "").includes("FORUM_POLL_CLOSED")) return "This poll has closed.";
  return message || "Something went wrong.";
}

async function loadRulesVersion(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data } = await supabase
    .from("forum_settings")
    .select("value")
    .eq("key", "rules_version")
    .maybeSingle();
  const version = Number(data?.value ?? 1);
  return Number.isFinite(version) ? version : 1;
}

async function contributionGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ForumActionResult | null> {
  const version = await loadRulesVersion(supabase);
  const { data: acceptance } = await supabase
    .from("forum_rules_acceptances")
    .select("user_id")
    .eq("user_id", userId)
    .eq("rules_version", version)
    .maybeSingle();
  if (!acceptance) return { needsRules: true };

  const { data: suspensions } = await supabase
    .from("forum_user_suspensions")
    .select("suspended_until, lifted_at")
    .eq("user_id", userId)
    .is("lifted_at", null);
  const active = (suspensions ?? []).some((row) => {
    if (!row.suspended_until) return true;
    return new Date(row.suspended_until).getTime() > Date.now();
  });
  if (active) return { error: FORUM_SUSPENDED_MESSAGE };
  return null;
}

async function requireIntroComplete(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<void> {
  const onboarding = await loadForumOnboardingState(supabase, userId);
  if (!onboarding.hasAgreedGuidelines) {
    redirect("/dashboard/community/forum/guidelines");
  }
  if (!onboarding.hasCompletedIntro) {
    redirect("/dashboard/community/forum/intro");
  }
}

export async function agreeToForumGuidelines(
  _prev: ForumActionResult,
  _formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const onboarding = await loadForumOnboardingState(supabase, userId);
  if (onboarding.hasAgreedGuidelines && onboarding.hasCompletedIntro) {
    redirect("/dashboard/community/forum");
  }
  if (onboarding.hasAgreedGuidelines) {
    redirect("/dashboard/community/forum/intro");
  }

  const version = await loadRulesVersion(supabase);
  const { error: acceptError } = await supabase.from("forum_rules_acceptances").upsert(
    { user_id: userId, rules_version: version },
    { onConflict: "user_id,rules_version" }
  );
  if (acceptError) return { error: acceptError.message };

  const { error } = await supabase
    .from("profiles")
    .update({ has_agreed_forum_guidelines: true, forum_guidelines_accepted_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community/forum/guidelines");
  revalidatePath("/dashboard/community/forum/intro");
  redirect("/dashboard/community/forum/intro");
}

export async function createForumIntroPost(
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  const onboarding = await loadForumOnboardingState(supabase, userId);

  if (!onboarding.hasAgreedGuidelines) {
    redirect("/dashboard/community/forum/guidelines");
  }
  if (onboarding.hasCompletedIntro) {
    redirect("/dashboard/community/forum");
  }

  const gate = await contributionGate(supabase, userId);
  if (gate) return gate;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Please write a short introduction." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", userId)
    .maybeSingle();

  const displayName = getDisplayName(profile) ?? "a new member";
  const title = `Hello from ${displayName}`;

  const { error: postError } = await supabase.from("forum_posts").insert({
    author_id: userId,
    title,
    body,
    category: FORUM_INTRO_CATEGORY,
    status: "visible",
  });

  if (postError) return { error: friendlyForumError(postError.message) };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ has_completed_community_intro: true })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  revalidatePath("/dashboard/community");
  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community/forum/intro");
  redirect("/dashboard/community/forum");
}

export async function createForumPost(
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  await requireIntroComplete(supabase, userId);
  const gate = await contributionGate(supabase, userId);
  if (gate) return gate;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!title || !body) return { error: "Title and message are required." };

  const pollOn = String(formData.get("poll_enabled") ?? "") === "on";
  const pollQuestion = String(formData.get("poll_question") ?? "").trim();
  const pollOptions = [1, 2, 3, 4, 5, 6]
    .map((index) => String(formData.get(`poll_option_${index}`) ?? "").trim())
    .filter(Boolean);
  const closesAt = String(formData.get("poll_closes_at") ?? "").trim();
  const allowMultiple = String(formData.get("poll_allow_multiple") ?? "") === "on";
  if (pollOn && (!pollQuestion || pollOptions.length < 2 || pollOptions.length > 6)) {
    return { error: "A poll needs a question and 2 to 6 options." };
  }

  const { data: post, error } = await supabase
    .from("forum_posts")
    .insert({
      author_id: userId,
      title,
      body,
      category,
    })
    .select("id")
    .single();

  if (error) return { error: friendlyForumError(error.message) };

  if (pollOn && post) {
    const { data: poll, error: pollError } = await supabase
      .from("forum_polls")
      .insert({
        post_id: post.id,
        question: pollQuestion,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        allow_multiple: allowMultiple,
      })
      .select("id")
      .single();
    if (pollError) return { error: friendlyForumError(pollError.message) };
    const { error: optionError } = await supabase.from("forum_poll_options").insert(
      pollOptions.map((label, position) => ({ poll_id: poll.id, label, position }))
    );
    if (optionError) return { error: friendlyForumError(optionError.message) };
  }

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community");
  return { success: "Post published." };
}

export async function createForumReply(
  postId: string,
  parentReplyId: string | null,
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Reply cannot be empty." };

  const { supabase, userId } = session;
  await requireIntroComplete(supabase, userId);
  const gate = await contributionGate(supabase, userId);
  if (gate) return gate;

  const parentId = parentReplyId?.trim() || null;
  if (parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("forum_replies")
      .select("id, post_id, status")
      .eq("id", parentId)
      .maybeSingle();

    if (parentError) return { error: parentError.message };
    if (!parent || parent.post_id !== postId || parent.status !== "visible") {
      return { error: "That reply is no longer available." };
    }
  }

  const { data: reply, error } = await supabase
    .from("forum_replies")
    .insert({
      post_id: postId,
      author_id: userId,
      body,
      ...(parentId ? { parent_reply_id: parentId } : {}),
    })
    .select("id")
    .single();

  if (error) return { error: friendlyForumError(error.message) };

  if (reply?.id) {
    const { notifyForumReply } = await import("@/lib/push/forum");
    await notifyForumReply({
      postId,
      replyId: reply.id,
      authorId: userId,
      body,
      parentReplyId: parentId,
    }).catch((pushError) => {
      console.error("[push] forum reply", pushError);
    });
  }

  revalidatePath(`/dashboard/community/forum/${postId}`);
  revalidatePath("/dashboard/community/forum");
  return { success: "Reply posted." };
}

export async function updateForumPost(
  postId: string,
  _prev: ForumActionResult,
  formData: FormData
): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;
  await requireIntroComplete(supabase, userId);

  const { data: post, error: loadError } = await supabase
    .from("forum_posts")
    .select("id, author_id, status")
    .eq("id", postId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!post || post.status !== "visible") return { error: "Post not found." };
  if (post.author_id !== userId) return { error: "You can only edit your own posts." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { error: "Title and message are required." };

  const editedAt = new Date().toISOString();
  let { error } = await supabase
    .from("forum_posts")
    .update({ title, body, edited_at: editedAt })
    .eq("id", postId)
    .eq("author_id", userId);

  if (error?.message?.toLowerCase().includes("edited_at")) {
    const fallback = await supabase
      .from("forum_posts")
      .update({ title, body })
      .eq("id", postId)
      .eq("author_id", userId);
    error = fallback.error;
  }

  if (error) return { error: friendlyForumError(error.message) };

  revalidatePath(`/dashboard/community/forum/${postId}`);
  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community");
  return { success: "Post updated." };
}

export async function deleteForumPost(postId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;

  const { supabase, userId } = session;

  const { data: post, error: loadError } = await supabase
    .from("forum_posts")
    .select("id, author_id, status")
    .eq("id", postId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!post || post.status === "deleted") return { error: "Post not found." };

  const isAuthor = post.author_id === userId;
  const isAdmin = await isMasterAdmin(userId, supabase);
  if (!isAuthor && !isAdmin) {
    return { error: "You do not have permission to delete this post." };
  }
  if (isAuthor && !isAdmin && post.status !== "visible") return { error: "Post not found." };

  const { error } = await supabase
    .from("forum_posts")
    .update({ status: "deleted" })
    .eq("id", postId);

  if (error) {
    if (error.message.toLowerCase().includes("deleted")) {
      return {
        error:
          'Database migration required: run supabase/forum-post-edited-threaded-replies.sql',
      };
    }
    return { error: error.message };
  }

  if (isAdmin) {
    await supabase
      .from("forum_reports")
      .update({
        status: "actioned",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        action_taken: "removed",
      })
      .eq("post_id", postId)
      .eq("status", "open");
  }

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community");
  revalidatePath(`/dashboard/community/forum/${postId}`);
  redirect("/dashboard/community/forum");
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
    const gate = await contributionGate(supabase, userId);
    if (gate) return gate;
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
    const gate = await contributionGate(supabase, userId);
    if (gate) return gate;
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

  const reason = String(formData.get("reason") ?? "").trim() as ForumReportReason;
  const details = String(formData.get("details") ?? "").trim();
  if (!FORUM_REPORT_REASONS.some((item) => item.id === reason)) {
    return { error: "Choose a reason." };
  }
  if (reason === "other" && !details) return { error: "Tell us a bit more." };
  if (details.length > 500) return { error: "Keep the details under 500 characters." };

  const { supabase, userId } = session;
  const { data: report, error } = await supabase
    .from("forum_reports")
    .insert({
      reporter_id: userId,
      post_id: targetType === "post" ? targetId : null,
      reply_id: targetType === "reply" ? targetId : null,
      reason,
      details: details || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      return { error: "You have already reported this." };
    }
    if (error.message.includes("FORUM_CANNOT_REPORT_OWN")) {
      return { error: "You can't report your own post." };
    }
    return { error: error.message };
  }

  await deliverForumReportEmail(report.id, userId);
  return { success: FORUM_REPORT_THANKS, reportId: report.id };
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

  const status = action === "hide" ? "hidden" : "deleted";
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
    .update({
      status: "actioned",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      action_taken: action === "hide" ? "hidden" : "removed",
    })
    .match({ ...reportFilter, status: "open" });

  revalidatePath("/dashboard/community/forum");
  revalidatePath("/dashboard/community/forum/moderation");
  revalidatePath("/admin/content/site");
  if (targetType === "post") {
    revalidatePath(`/dashboard/community/forum/${targetId}`);
  }

  return { success: action === "hide" ? "Content hidden." : "Content removed." };
}

export async function acceptForumRules(): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;
  const { supabase, userId } = session;
  const version = await loadRulesVersion(supabase);
  const { error } = await supabase.from("forum_rules_acceptances").upsert(
    { user_id: userId, rules_version: version },
    { onConflict: "user_id,rules_version" }
  );
  if (error) return { error: error.message };
  await supabase.from("profiles").update({ has_agreed_forum_guidelines: true, forum_guidelines_accepted_at: new Date().toISOString() }).eq("id", userId);
  return { success: "Agreed." };
}

export async function blockForumUser(blockedId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;
  if (blockedId === session.userId) return { error: "You can't block yourself." };
  const { error } = await session.supabase.from("forum_user_blocks").insert({
    blocker_id: session.userId,
    blocked_id: blockedId,
  });
  if (error && error.code !== "23505") return { error: error.message };
  revalidatePath("/dashboard/community/forum");
  return { success: "Blocked." };
}

export async function unblockForumUser(formData: FormData): Promise<void> {
  const session = await requireForumMember();
  if (!session.ok) return;
  const blockedId = String(formData.get("blocked_id") ?? "");
  if (!blockedId) return;
  await session.supabase
    .from("forum_user_blocks")
    .delete()
    .eq("blocker_id", session.userId)
    .eq("blocked_id", blockedId);
  revalidatePath("/dashboard/profile/blocked");
  revalidatePath("/dashboard/community/forum");
}

export async function castForumPollVote(pollId: string, optionId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;
  const gate = await contributionGate(session.supabase, session.userId);
  if (gate) return gate;
  const { error } = await session.supabase.from("forum_poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    user_id: session.userId,
  });
  if (error) return { error: friendlyForumError(error.message) };
  revalidatePath("/dashboard/community/forum");
  return { success: "Vote saved." };
}

export async function deleteForumReply(replyId: string, postId: string): Promise<ForumActionResult> {
  const session = await requireForumMember();
  if (!session.ok) return session.result;
  const isAdmin = await isMasterAdmin(session.userId, session.supabase);
  const { data: reply } = await session.supabase
    .from("forum_replies")
    .select("author_id")
    .eq("id", replyId)
    .maybeSingle();
  if (!reply) return { error: "Reply not found." };
  if (reply.author_id !== session.userId && !isAdmin) {
    return { error: "You do not have permission to delete this reply." };
  }
  const { error } = await session.supabase
    .from("forum_replies")
    .update({ status: "deleted" })
    .eq("id", replyId);
  if (error) return { error: error.message };
  if (isAdmin) {
    await session.supabase
      .from("forum_reports")
      .update({
        status: "actioned",
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.userId,
        action_taken: "removed",
      })
      .eq("reply_id", replyId)
      .eq("status", "open");
  }
  revalidatePath(`/dashboard/community/forum/${postId}`);
  return { success: "Reply removed." };
}
