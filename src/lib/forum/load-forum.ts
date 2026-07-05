import type { AppRole } from "@/lib/auth/admin-access";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadCurrentUserAppRoles } from "@/lib/tutoring/tutor-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FORUM_STAFF_ROLES } from "./access";
import type { ForumAuthor, ForumPostDetail, ForumPostSummary, ForumReply, ForumReportRow } from "./types";

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
};

type PostRow = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  like_count: number;
  created_at: string;
  author_id: string;
  profiles: ProfileRow | ProfileRow[] | null;
};

type ReplyRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  post_id: string;
  profiles: ProfileRow | ProfileRow[] | null;
};

function unwrapProfile(
  profiles: ProfileRow | ProfileRow[] | null,
  authorId: string
): ProfileRow {
  if (Array.isArray(profiles)) {
    return profiles[0] ?? { id: authorId, full_name: null, preferred_name: null, avatar_url: null };
  }
  return profiles ?? { id: authorId, full_name: null, preferred_name: null, avatar_url: null };
}

async function loadStaffRolesByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, AppRole[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profile_roles")
    .select("user_id, role")
    .in("user_id", userIds);

  if (error) throw error;

  const map = new Map<string, AppRole[]>();
  for (const row of data ?? []) {
    const roles = map.get(row.user_id) ?? [];
    roles.push(row.role as AppRole);
    map.set(row.user_id, roles);
  }
  return map;
}

function toAuthor(profile: ProfileRow, staffRoles: AppRole[]): ForumAuthor {
  return {
    id: profile.id,
    displayName: getDisplayName(profile) ?? "Member",
    avatarUrl: profile.avatar_url,
    staffRoles: staffRoles.filter((role) => FORUM_STAFF_ROLES.includes(role)),
  };
}

async function loadReplyCounts(
  supabase: SupabaseClient,
  postIds: string[]
): Promise<Map<string, number>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("forum_replies")
    .select("post_id")
    .in("post_id", postIds)
    .eq("status", "visible");

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  return counts;
}

async function loadPostLikesByViewer(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("forum_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id).filter(Boolean) as string[]);
}

async function loadReplyLikesByViewer(
  supabase: SupabaseClient,
  userId: string,
  replyIds: string[]
): Promise<Set<string>> {
  if (replyIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("forum_likes")
    .select("reply_id")
    .eq("user_id", userId)
    .in("reply_id", replyIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.reply_id).filter(Boolean) as string[]);
}

async function loadReplyLikeCounts(
  supabase: SupabaseClient,
  replyIds: string[]
): Promise<Map<string, number>> {
  if (replyIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("forum_likes")
    .select("reply_id")
    .in("reply_id", replyIds);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.reply_id) continue;
    counts.set(row.reply_id, (counts.get(row.reply_id) ?? 0) + 1);
  }
  return counts;
}

function mapPostSummary(
  row: PostRow,
  staffRolesByUser: Map<string, AppRole[]>,
  replyCounts: Map<string, number>,
  likedPostIds: Set<string>
): ForumPostSummary {
  const profile = unwrapProfile(row.profiles, row.author_id);
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    likeCount: row.like_count,
    replyCount: replyCounts.get(row.id) ?? 0,
    createdAt: row.created_at,
    author: toAuthor(profile, staffRolesByUser.get(row.author_id) ?? []),
    likedByViewer: likedPostIds.has(row.id),
  };
}

export async function loadForumPosts(
  supabase: SupabaseClient,
  viewerUserId: string
): Promise<ForumPostSummary[]> {
  const { data, error } = await supabase
    .from("forum_posts")
    .select(
      "id, title, category, like_count, created_at, author_id, profiles:author_id (id, full_name, preferred_name, avatar_url)"
    )
    .eq("status", "visible")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as PostRow[];
  const postIds = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.author_id))];

  const [staffRolesByUser, replyCounts, likedPostIds] = await Promise.all([
    loadStaffRolesByUserId(supabase, authorIds),
    loadReplyCounts(supabase, postIds),
    loadPostLikesByViewer(supabase, viewerUserId, postIds),
  ]);

  return rows.map((row) =>
    mapPostSummary(row, staffRolesByUser, replyCounts, likedPostIds)
  );
}

export async function loadForumPostDetail(
  supabase: SupabaseClient,
  viewerUserId: string,
  postId: string
): Promise<{ post: ForumPostDetail; replies: ForumReply[] } | null> {
  const { data: postRow, error: postError } = await supabase
    .from("forum_posts")
    .select(
      "id, title, body, category, like_count, created_at, author_id, status, profiles:author_id (id, full_name, preferred_name, avatar_url)"
    )
    .eq("id", postId)
    .maybeSingle();

  if (postError) throw postError;
  if (!postRow || postRow.status !== "visible") return null;

  const { data: replyRows, error: replyError } = await supabase
    .from("forum_replies")
    .select(
      "id, body, created_at, author_id, post_id, profiles:author_id (id, full_name, preferred_name, avatar_url)"
    )
    .eq("post_id", postId)
    .eq("status", "visible")
    .order("created_at", { ascending: true });

  if (replyError) throw replyError;

  const post = postRow as PostRow & { body: string };
  const replies = (replyRows ?? []) as ReplyRow[];
  const authorIds = [
    ...new Set([post.author_id, ...replies.map((reply) => reply.author_id)]),
  ];
  const replyIds = replies.map((reply) => reply.id);

  const [staffRolesByUser, replyCounts, likedPostIds, likedReplyIds, replyLikeCounts] =
    await Promise.all([
      loadStaffRolesByUserId(supabase, authorIds),
      loadReplyCounts(supabase, [postId]),
      loadPostLikesByViewer(supabase, viewerUserId, [postId]),
      loadReplyLikesByViewer(supabase, viewerUserId, replyIds),
      loadReplyLikeCounts(supabase, replyIds),
    ]);

  const summary = mapPostSummary(post, staffRolesByUser, replyCounts, likedPostIds);

  return {
    post: { ...summary, body: post.body },
    replies: replies.map((reply) => {
      const profile = unwrapProfile(reply.profiles, reply.author_id);
      return {
        id: reply.id,
        body: reply.body,
        createdAt: reply.created_at,
        author: toAuthor(profile, staffRolesByUser.get(reply.author_id) ?? []),
        likedByViewer: likedReplyIds.has(reply.id),
        likeCount: replyLikeCounts.get(reply.id) ?? 0,
      };
    }),
  };
}

export async function loadOpenForumReports(
  supabase: SupabaseClient
): Promise<ForumReportRow[]> {
  const { data, error } = await supabase
    .from("forum_reports")
    .select(
      "id, reason, status, created_at, post_id, reply_id, reporter_id, profiles:reporter_id (full_name, preferred_name)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const postIds = rows.map((row) => row.post_id).filter(Boolean) as string[];
  const replyIds = rows.map((row) => row.reply_id).filter(Boolean) as string[];

  const [{ data: posts }, { data: replies }] = await Promise.all([
    postIds.length > 0
      ? supabase.from("forum_posts").select("id, title, body").in("id", postIds)
      : Promise.resolve({ data: [] as { id: string; title: string; body: string }[] }),
    replyIds.length > 0
      ? supabase.from("forum_replies").select("id, body").in("id", replyIds)
      : Promise.resolve({ data: [] as { id: string; body: string }[] }),
  ]);

  const postById = new Map((posts ?? []).map((post) => [post.id, post]));
  const replyById = new Map((replies ?? []).map((reply) => [reply.id, reply]));

  return rows.map((row) => {
    const reporterProfile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const reporterName = getDisplayName(reporterProfile) ?? "Member";

    if (row.post_id) {
      const post = postById.get(row.post_id);
      return {
        id: row.id,
        reason: row.reason,
        createdAt: row.created_at,
        status: row.status as ForumReportRow["status"],
        targetType: "post" as const,
        targetId: row.post_id,
        targetPreview: post?.title ?? "(Post unavailable)",
        reporterName,
      };
    }

    const reply = replyById.get(row.reply_id!);
    return {
      id: row.id,
      reason: row.reason,
      createdAt: row.created_at,
      status: row.status as ForumReportRow["status"],
      targetType: "reply" as const,
      targetId: row.reply_id!,
      targetPreview: reply?.body.slice(0, 120) ?? "(Reply unavailable)",
      reporterName,
    };
  });
}

export async function viewerIsForumModerator(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const roles = await loadCurrentUserAppRoles(supabase, userId);
  return roles.some((role) => FORUM_STAFF_ROLES.includes(role));
}
