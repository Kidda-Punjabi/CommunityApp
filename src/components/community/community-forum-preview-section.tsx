import Link from "next/link";
import { StaffRoleBadge } from "@/components/forum/staff-role-badge";
import { HubCard, HubGhostLink } from "@/components/ui/hub-primitives";
import { forumComposerPath } from "@/lib/forum/access";
import type { ForumOnboardingState } from "@/lib/forum/access";
import type { ForumPostPreview } from "@/lib/forum/types";

type CommunityForumPreviewSectionProps = {
  posts: ForumPostPreview[];
  onboarding: ForumOnboardingState;
};

export function CommunityForumPreviewSection({
  posts,
  onboarding,
}: CommunityForumPreviewSectionProps) {
  const composerHref = forumComposerPath(onboarding);
  const latest = posts[0] ?? null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900">Community forum</h2>
        <HubGhostLink href="/dashboard/community/forum">Open forum</HubGhostLink>
      </div>

      <HubCard className="py-4">
        {latest ? (
          <Link
            href={`/dashboard/community/forum/${latest.id}`}
            className="block rounded-lg transition-colors hover:bg-violet-50/40 -mx-2 px-2 py-1"
          >
            <p className="font-medium text-zinc-900">{latest.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span>{latest.author.displayName}</span>
              <StaffRoleBadge roles={latest.author.staffRoles} className="!px-2 !py-0" />
              <span aria-hidden="true">·</span>
              <span>
                {latest.replyCount} repl{latest.replyCount === 1 ? "y" : "ies"}
              </span>
            </div>
            {latest.bodySnippet ? (
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{latest.bodySnippet}</p>
            ) : null}
          </Link>
        ) : (
          <p className="text-sm text-zinc-600">
            No posts yet — be the first to start a conversation.
          </p>
        )}

        <div className="mt-3 border-t border-zinc-100 pt-3">
          <Link
            href={composerHref}
            className="text-sm font-medium text-violet-600 hover:text-violet-500"
          >
            Write a post
          </Link>
        </div>
      </HubCard>
    </section>
  );
}
