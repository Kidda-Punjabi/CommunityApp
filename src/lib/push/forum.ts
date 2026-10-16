import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getDisplayName } from "@/lib/profile/display-name";
import { sendPush } from "@/lib/push/send";

function snippet(body: string): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

async function blocked(recipientId: string, authorId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("forum_user_blocks")
    .select("blocker_id")
    .eq("blocker_id", recipientId)
    .eq("blocked_id", authorId)
    .maybeSingle();
  return Boolean(data);
}

export async function notifyForumReply(input: {
  postId: string;
  replyId: string;
  authorId: string;
  body: string;
  parentReplyId?: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  const [{ data: post }, { data: author }, { data: parent }] = await Promise.all([
    admin.from("forum_posts").select("id, author_id, status").eq("id", input.postId).maybeSingle(),
    admin.from("profiles").select("full_name, preferred_name").eq("id", input.authorId).maybeSingle(),
    input.parentReplyId
      ? admin
          .from("forum_replies")
          .select("id, author_id, status")
          .eq("id", input.parentReplyId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!post || post.status !== "visible") return;
  const name = getDisplayName(author) ?? "Someone";
  const quote = snippet(input.body);
  const windowKey = Math.floor(Date.now() / (10 * 60 * 1000));

  if (post.author_id && post.author_id !== input.authorId) {
    if (!(await blocked(post.author_id as string, input.authorId))) {
      await sendPush({
        userId: post.author_id as string,
        type: "F1",
        refKey: `${input.postId}:${windowKey}`,
        title: `${name} replied to your post`,
        body: `"${quote}"`,
        url: `/dashboard/community/forum/${input.postId}`,
      });
    }
  }

  if (
    parent &&
    parent.status === "visible" &&
    parent.author_id &&
    parent.author_id !== input.authorId
  ) {
    if (!(await blocked(parent.author_id as string, input.authorId))) {
      await sendPush({
        userId: parent.author_id as string,
        type: "F2",
        refKey: input.replyId,
        title: `${name} replied to you`,
        body: `"${quote}"`,
        url: `/dashboard/community/forum/${input.postId}`,
      });
    }
  }
}
