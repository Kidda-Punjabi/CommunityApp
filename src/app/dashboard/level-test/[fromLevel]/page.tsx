import { BackLink } from "@/components/navigation/back-link";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LevelTestClient } from "@/components/progression/level-test-client";
import { loadLevelTestQuestions } from "@/lib/progression/level-test-service";
import { loadUserProgression } from "@/lib/progression/load-user-progression";
import { levelTestLabel } from "@/lib/progression/tiers";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type PageProps = {
  params: Promise<{ fromLevel: string }>;
};

export default async function LevelTestPage({ params }: PageProps) {
  const { fromLevel: fromLevelRaw } = await params;
  const fromLevel = Number.parseInt(fromLevelRaw, 10);

  if (!Number.isFinite(fromLevel) || fromLevel < 1 || fromLevel > 7) {
    redirect("/dashboard/profile");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const progression = await loadUserProgression(supabase, user.id);

  if (!progression.placementCompleted || progression.learnerLevel == null) {
    redirect("/dashboard/placement");
  }

  const questions = await loadLevelTestQuestions(supabase, fromLevel).catch(() => []);

  return (
    <div className={`${ui.page} space-y-4`}>
      <div>
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600">← Profile</BackLink>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">{levelTestLabel(fromLevel)}</h1>
        {progression.nextTier && (
          <p className="mt-1 text-sm text-zinc-500">
            Pass with 95%+ to reach Level {progression.nextTier.tier}: {progression.nextTier.name}
          </p>
        )}
      </div>
      <LevelTestClient
        fromLevel={fromLevel}
        learnerLevel={progression.learnerLevel}
        questions={questions}
        testUnlocked={progression.testUnlocked}
      />
    </div>
  );
}
