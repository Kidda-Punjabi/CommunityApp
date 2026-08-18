import { BackLink } from "@/components/navigation/back-link";
import { CommunityTutorPicksSection } from "@/components/community/community-tutor-picks-section";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { loadTutorPicksForStudent } from "@/lib/community/recommendations";
import { ui } from "@/lib/ui/styles";

export default async function CommunityPicksPage() {
  const { user, supabase } = await requireNoKidCommunityAccess();
  const groups = await loadTutorPicksForStudent(supabase, user.id);

  return (
    <div className={ui.page}>
      <BackLink
        fallbackHref="/dashboard/community"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to Community
      </BackLink>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Your tutor&apos;s picks</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Movies, books, and recipes your tutor recommends.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">No tutor assigned yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Picks appear here once you have a tutor for an active class.
          </p>
        </div>
      ) : (
        <CommunityTutorPicksSection groups={groups} />
      )}
    </div>
  );
}
