import { ForumLikeButton } from "@/components/forum/forum-like-button";
import { ForumReportDialog } from "@/components/forum/forum-report-dialog";
import { ForumReplyForm, ForumReplyItem } from "@/components/forum/forum-reply-section";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import { UserAvatar } from "@/components/profile/user-avatar";
import { canAccessForum } from "@/lib/forum/access";
import { loadForumPostDetail } from "@/lib/forum/load-forum";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function formatForumDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type PageProps = {
  params: Promise<{ postId: string }>;
};

export default async function ForumPostPage({ params }: PageProps) {
  const { postId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  if (!(await canAccessForum(supabase, user.id))) {
    redirect("/dashboard/community/forum");
  }

  const detail = await loadForumPostDetail(supabase, user.id, postId);
  if (!detail) notFound();

  const { post, replies } = detail;

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/community/forum"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to forum
      </Link>

      <article className={`${ui.cardBordered} mt-4`}>
        <div className="flex items-start gap-3">
          <UserAvatar
            profile={{
              full_name: post.author.displayName,
              preferred_name: post.author.displayName,
              avatar_url: post.author.avatarUrl,
            }}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">{post.author.displayName}</span>
              <StaffRoleBadge roles={post.author.staffRoles} />
              <span className="text-xs text-zinc-400">{formatForumDate(post.createdAt)}</span>
            </div>
            <h1 className="mt-2 font-heading text-xl font-bold text-zinc-900">{post.title}</h1>
            {post.category && (
              <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {post.category}
              </span>
            )}
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{post.body}</p>

        <div className="mt-4 flex items-center gap-4 border-t border-zinc-100 pt-4">
          <ForumLikeButton
            targetType="post"
            targetId={post.id}
            postId={post.id}
            initialLiked={post.likedByViewer}
            initialCount={post.likeCount}
          />
          <ForumReportDialog targetType="post" targetId={post.id} />
        </div>
      </article>

      <section className="mt-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-zinc-900">
          {replies.length} repl{replies.length === 1 ? "y" : "ies"}
        </h2>
        <div className={ui.stack}>
          {replies.map((reply) => (
            <ForumReplyItem key={reply.id} reply={reply} postId={post.id} />
          ))}
        </div>
      </section>

      <div className="mt-6">
        <ForumReplyForm postId={post.id} />
      </div>
    </div>
  );
}
