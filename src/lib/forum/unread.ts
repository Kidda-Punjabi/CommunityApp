import type { SupabaseClient } from "@supabase/supabase-js";

export type ForumUnread = {
  fresh: number;
  replies: number;
};

export async function loadForumUnread(supabase: SupabaseClient, userId: string): Promise<ForumUnread> {
  const [{ data: state }, { data: profile }, { data: blocks }] = await Promise.all([
    supabase.from("forum_read_state").select("last_seen_at").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("forum_guidelines_accepted_at").eq("id", userId).maybeSingle(),
    supabase.from("forum_user_blocks").select("blocked_id").eq("blocker_id", userId),
  ]);
  const since = (state?.last_seen_at as string | undefined)
    ?? (profile?.forum_guidelines_accepted_at as string | undefined)
    ?? new Date().toISOString();
  const blocked = new Set((blocks ?? []).map((row) => row.blocked_id as string));

  const [{ data: posts }, { data: replies }, { data: mine }, { data: myReplies }] = await Promise.all([
    supabase.from("forum_posts").select("id, author_id").eq("status", "visible").gt("created_at", since),
    supabase.from("forum_replies").select("id, post_id, author_id, parent_reply_id").eq("status", "visible").gt("created_at", since),
    supabase.from("forum_posts").select("id").eq("author_id", userId).eq("status", "visible"),
    supabase.from("forum_replies").select("id").eq("author_id", userId).eq("status", "visible"),
  ]);

  const visible = (authorId: string) => authorId !== userId && !blocked.has(authorId);
  const freshPosts = (posts ?? []).filter((post) => visible(post.author_id as string));
  const freshReplies = (replies ?? []).filter((reply) => visible(reply.author_id as string));
  const mineIds = new Set((mine ?? []).map((post) => post.id as string));
  const myReplyIds = new Set((myReplies ?? []).map((reply) => reply.id as string));
  const repliesToYou = freshReplies.filter(
    (reply) => mineIds.has(reply.post_id as string) || myReplyIds.has(reply.parent_reply_id as string)
  );
  return { fresh: freshPosts.length + freshReplies.length, replies: repliesToYou.length };
}

export async function markForumSeen(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from("forum_read_state").upsert({
    user_id: userId,
    last_seen_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to mark forum seen:", error.message);
}

export function freshLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+ new";
  return `${count} new`;
}
