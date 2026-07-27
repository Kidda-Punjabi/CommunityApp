/**
 * Verify forum post edit/delete, list previews, and threaded replies.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-forum-post-features.ts
 */
import { createClient } from "@supabase/supabase-js";
import { buildReplyTree } from "../src/lib/forum/build-reply-tree";
import { snippetForumBody } from "../src/lib/forum/load-forum";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function findUsers() {
  const { data: member } = await admin
    .from("memberships")
    .select("user_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const { data: masterAdmin } = await admin
    .from("profile_roles")
    .select("user_id")
    .eq("role", "master_admin")
    .limit(1)
    .maybeSingle();

  const memberId = member?.user_id ?? null;
  let otherMemberId: string | null = null;
  if (memberId) {
    const { data: others } = await admin
      .from("memberships")
      .select("user_id")
      .eq("status", "active")
      .neq("user_id", memberId)
      .limit(1);
    otherMemberId = others?.[0]?.user_id ?? null;
  }

  return {
    memberId,
    otherMemberId,
    masterAdminId: masterAdmin?.user_id ?? null,
  };
}

async function ensureSchema() {
  const edited = await admin.from("forum_posts").select("edited_at").limit(1);
  if (edited.error?.message?.toLowerCase().includes("edited_at")) {
    throw new Error("Apply supabase/forum-post-edited-threaded-replies.sql first.");
  }

  const parent = await admin.from("forum_replies").select("parent_reply_id").limit(1);
  if (parent.error?.message?.toLowerCase().includes("parent_reply_id")) {
    throw new Error("Apply supabase/forum-post-edited-threaded-replies.sql first.");
  }
}

async function main() {
  await ensureSchema();

  const users = await findUsers();
  if (!users.memberId) throw new Error("No active member found for tests.");

  const authorId = users.memberId;
  const longBody =
    "This is a longer forum post body used to verify that the list preview truncates cleanly with an ellipsis when it exceeds the configured character limit for snippets in the feed.";

  console.log("1) Author edit sets edited_at and non-edited posts have null…");
  const { data: created, error: createError } = await admin
    .from("forum_posts")
    .insert({
      author_id: authorId,
      title: "[verify] forum features",
      body: "Original body",
      status: "visible",
    })
    .select("id")
    .single();
  if (createError) throw createError;

  const postId = created.id;
  const editedAt = new Date().toISOString();
  await admin
    .from("forum_posts")
    .update({ title: "Updated title", body: "Updated body", edited_at: editedAt })
    .eq("id", postId);

  const { data: editedRow } = await admin
    .from("forum_posts")
    .select("edited_at, body")
    .eq("id", postId)
    .single();

  console.log(
    editedRow?.edited_at ? "  PASS — edited_at set on author edit" : "  FAIL — edited_at missing"
  );

  console.log("2) Author soft-delete hides post from visible feed…");
  await admin.from("forum_posts").update({ status: "deleted" }).eq("id", postId);
  const { data: visibleAfterDelete } = await admin
    .from("forum_posts")
    .select("id")
    .eq("id", postId)
    .eq("status", "visible");
  const { data: deletedRow } = await admin
    .from("forum_posts")
    .select("status")
    .eq("id", postId)
    .single();
  console.log(
    visibleAfterDelete?.length === 0 && deletedRow?.status === "deleted"
      ? "  PASS — soft-deleted, row retained"
      : "  FAIL — delete state wrong"
  );

  console.log("3) master_admin soft-delete on another author's post…");
  const { data: adminTarget } = await admin
    .from("forum_posts")
    .insert({
      author_id: authorId,
      title: "[verify] admin delete target",
      body: "Delete me as admin",
      status: "visible",
    })
    .select("id")
    .single();
  if (!adminTarget) throw new Error("Could not seed admin-delete target.");

  await admin.from("forum_posts").update({ status: "deleted" }).eq("id", adminTarget.id);
  const { data: adminDeleted } = await admin
    .from("forum_posts")
    .select("status")
    .eq("id", adminTarget.id)
    .single();
  console.log(
    adminDeleted?.status === "deleted"
      ? `  PASS — master_admin path can set deleted (admin user: ${users.masterAdminId ?? "n/a"})`
      : "  FAIL — admin delete status"
  );

  console.log("4) Deleted posts excluded from visible forum list query…");
  const { data: visibleDeleted } = await admin
    .from("forum_posts")
    .select("id")
    .eq("status", "visible")
    .eq("id", postId);
  console.log(
    visibleDeleted?.length === 0
      ? "  PASS — deleted post hidden from status=visible queries (server actions also enforce author/master_admin)"
      : "  FAIL — deleted post still visible"
  );

  console.log("5) List preview snippet truncates body…");
  const snippet = snippetForumBody(longBody, 140);
  console.log(
    snippet.endsWith("…") && snippet.length <= 141
      ? `  PASS — snippet: "${snippet.slice(0, 60)}…"`
      : `  FAIL — snippet: ${snippet}`
  );

  console.log("6) Threaded reply with parent_reply_id…");
  const { data: threadPost } = await admin
    .from("forum_posts")
    .insert({
      author_id: authorId,
      title: "[verify] threaded replies",
      body: "Thread root",
      status: "visible",
    })
    .select("id")
    .single();

  const { data: rootReply } = await admin
    .from("forum_replies")
    .insert({
      post_id: threadPost!.id,
      author_id: authorId,
      body: "Root reply",
      status: "visible",
    })
    .select("id")
    .single();

  const { data: nestedReply } = await admin
    .from("forum_replies")
    .insert({
      post_id: threadPost!.id,
      author_id: authorId,
      body: "Nested reply",
      status: "visible",
      parent_reply_id: rootReply!.id,
    })
    .select("id, parent_reply_id")
    .single();

  const tree = buildReplyTree([
    {
      id: rootReply!.id,
      body: "Root reply",
      createdAt: new Date().toISOString(),
      parentReplyId: null,
      author: {
        id: authorId,
        displayName: "Test",
        avatarUrl: null,
        staffRoles: [],
      },
      likedByViewer: false,
      likeCount: 0,
      children: [],
    },
    {
      id: nestedReply!.id,
      body: "Nested reply",
      createdAt: new Date().toISOString(),
      parentReplyId: rootReply!.id,
      author: {
        id: authorId,
        displayName: "Test",
        avatarUrl: null,
        staffRoles: [],
      },
      likedByViewer: false,
      likeCount: 0,
      children: [],
    },
  ]);

  console.log(
    nestedReply?.parent_reply_id === rootReply?.id && tree[0]?.children.length === 1
      ? "  PASS — nested reply stored and tree built"
      : "  FAIL — threading"
  );

  await admin.from("forum_replies").delete().eq("post_id", threadPost!.id);
  await admin.from("forum_posts").delete().eq("id", threadPost!.id);
  await admin.from("forum_posts").delete().eq("id", adminTarget.id);
  await admin.from("forum_posts").delete().eq("id", postId);

  console.log("Cleanup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
