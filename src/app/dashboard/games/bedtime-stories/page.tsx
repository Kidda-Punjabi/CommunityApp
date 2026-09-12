import { KidBedtimeStoriesPanel } from "@/components/kids/kid-bedtime-stories-panel";
import { BackLink } from "@/components/navigation/back-link";
import { loadKidBedtimeStoriesForParent } from "@/lib/kids/bedtime-stories";
import { usesKidsShell } from "@/lib/kids/constants";
import { loadKidSession } from "@/lib/kids/session";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function BedtimeStoriesGamesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const kidSession = await loadKidSession(session.user.id);
  const olderKid =
    kidSession.activeKidProfile && !usesKidsShell(kidSession.activeKidProfile.age_tier);
  if (!olderKid) redirect("/dashboard/games");

  const bedtimeStories = await loadKidBedtimeStoriesForParent(
    session.supabase,
    session.user.id
  );

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/games">← Back to Games</BackLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Bedtime Stories</h1>
        <p className="mt-1 text-sm text-zinc-500">Listen to a story in Punjabi.</p>
      </div>
      <KidBedtimeStoriesPanel
        stories={bedtimeStories.stories}
        parentIsPremium={bedtimeStories.parentIsPremium}
        tableReady={bedtimeStories.tableReady}
      />
    </div>
  );
}
