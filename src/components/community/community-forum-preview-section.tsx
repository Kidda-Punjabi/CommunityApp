import Link from "next/link";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import { forumComposerPath } from "@/lib/forum/access";
import type { ForumOnboardingState } from "@/lib/forum/access";
import type { ForumPostPreview } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

type CommunityForumPreviewSectionProps = {
  posts: ForumPostPreview[];
  onboarding: ForumOnboardingState;
};

export function CommunityForumPreviewSection({
  posts,
  onboarding,
}: CommunityForumPreviewSectionProps) {
  const composerHref = forumComposerPath(onboarding);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900">Community forum</h2>
        <Link
          href="/dashboard/community/forum"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          Open forum
        </Link>
      </div>

      {posts.length > 0 ? (
        <div className={ui.stack}>
          {posts.map((post) => (
            <ForumPostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className={`${ui.cardBordered} text-sm text-zinc-600`}>
          No posts yet — be the first to start a conversation.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={composerHref} className={ui.btnPrimary}>
          Write a post
        </Link>
      </div>
    </section>
  );
}
