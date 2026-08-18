import { RecommendationPickCard } from "@/components/community/recommendation-pick-card";
import { HubGhostLink } from "@/components/ui/hub-primitives";
import type { TutorPickGroup } from "@/lib/community/recommendation-types";

function groupHeading(groups: TutorPickGroup[], group: TutorPickGroup): string {
  if (groups.length === 1) return "Your tutor's picks";
  return `${group.tutorName}'s picks`;
}

export function CommunityTutorPicksSection({
  groups,
  compact = false,
}: {
  groups: TutorPickGroup[];
  compact?: boolean;
}) {
  if (groups.length === 0) return null;

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const previewCount = compact ? 3 : Number.POSITIVE_INFINITY;
  let remaining = previewCount;
  const previewGroups = groups
    .map((group) => {
      const items = group.items.slice(0, Math.max(0, remaining));
      remaining -= items.length;
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0 || !compact);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900">
          {groups.length === 1 ? "Your tutor's picks" : "Your tutors' picks"}
        </h2>
        {compact && totalItems > 0 ? (
          <HubGhostLink href="/dashboard/community/picks">See all</HubGhostLink>
        ) : null}
      </div>

      {totalItems === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600">
          Your tutor hasn&apos;t shared any movie, book, or recipe picks yet.
        </p>
      ) : (
        <div className="space-y-6">
          {previewGroups.map((group) => (
            <div key={group.tutorId} className="space-y-3">
              {groups.length > 1 ? (
                <h3 className="text-sm font-semibold text-zinc-800">
                  {groupHeading(groups, group)}
                </h3>
              ) : null}
              {group.items.length === 0 ? (
                <p className="text-sm text-zinc-500">No picks yet.</p>
              ) : (
                group.items.map((item) => (
                  <RecommendationPickCard key={item.favoriteId} item={item} />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
