import { ForumFeed } from "@/components/forum/forum-feed";
import { requireForumAccessAllowed } from "@/lib/kids/guards";
import {
  canAccessForum,
  canModerateForum,
  forumComposerPath,
  loadForumOnboardingState,
} from "@/lib/forum/access";
import { loadForumPosts } from "@/lib/forum/load-forum";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ForumPage() {
  const { user, supabase } = await requireForumAccessAllowed();
  const hasAccess = await canAccessForum(supabase, user.id);
  if (!hasAccess) {
    return (
      <div className={ui.page}>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Community forum</h1>
        <div className={`${ui.emptyState} mt-8`}>
          <p className="text-sm text-zinc-600">
            The forum is available to active Kidda community members and staff.
          </p>
          <Link href="/dashboard/community" className={`${ui.btnSecondary} mt-4`}>
            Back to Community
          </Link>
        </div>
      </div>
    );
  }

  const [posts, onboarding, isModerator] = await Promise.all([
    loadForumPosts(supabase, user.id),
    loadForumOnboardingState(supabase, user.id),
    canModerateForum(supabase, user.id),
  ]);

  if (onboarding.hasAgreedGuidelines && !onboarding.hasCompletedIntro) {
    redirect("/dashboard/community/forum/intro");
  }

  const composerHref = forumComposerPath(onboarding);

  return (
    <div className={ui.page}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/community"
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            ← Community
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Forum</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ask questions and learn from other members and tutors.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link href={composerHref} className={ui.btnPrimary}>
            New post
          </Link>
          {isModerator ? (
            <Link
              href="/dashboard/community/forum/moderation"
              className="text-sm font-medium text-zinc-500 hover:text-violet-600"
            >
              Moderation
            </Link>
          ) : null}
        </div>
      </div>

      {!onboarding.hasAgreedGuidelines ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Before your first post, please{" "}
          <Link href="/dashboard/community/forum/guidelines" className="font-semibold underline">
            read and accept the community guidelines
          </Link>
          .
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-sm text-zinc-600">No posts yet. Be the first to start a conversation.</p>
        </div>
      ) : (
        <ForumFeed posts={posts} />
      )}
    </div>
  );
}
