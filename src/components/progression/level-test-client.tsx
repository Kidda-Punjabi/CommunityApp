"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LevelTestPlayer } from "@/components/progression/level-test-player";
import {
  recordLevelTestAttempt,
} from "@/lib/progression/level-test-service";
import type { LevelTestQuestion } from "@/lib/progression/level-tests";
import { getTierByNumber, levelTestLabel } from "@/lib/progression/tiers";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type LevelTestClientProps = {
  fromLevel: number;
  learnerLevel: number;
  questions: LevelTestQuestion[];
  testUnlocked: boolean;
};

export function LevelTestClient({
  fromLevel,
  learnerLevel,
  questions,
  testUnlocked,
}: LevelTestClientProps) {
  const router = useRouter();

  if (fromLevel !== learnerLevel) {
    return (
      <div className={ui.card}>
        <p className="text-sm text-zinc-600">This test doesn&apos;t match your current level.</p>
        <Link href="/dashboard/profile" className="mt-3 inline-block text-sm font-medium text-violet-600">
          ← Profile
        </Link>
      </div>
    );
  }

  if (!testUnlocked) {
    return (
      <div className={ui.card}>
        <p className="text-sm text-zinc-600">
          Earn more XP to unlock the {levelTestLabel(fromLevel)}.
        </p>
        <Link href="/dashboard/profile" className="mt-3 inline-block text-sm font-medium text-violet-600">
          ← Profile
        </Link>
      </div>
    );
  }

  return (
    <LevelTestPlayer
      fromLevel={fromLevel}
      questions={questions}
      mode="progression"
      backHref="/dashboard/profile"
      onComplete={async ({ correctCount, totalCount }) => {
        const supabase = createClient();
        await recordLevelTestAttempt(supabase, {
          fromLevel,
          correctCount,
          totalCount,
          isPlacement: false,
          setLevelOnPass: true,
        });
        router.push("/dashboard/profile");
        router.refresh();
      }}
    />
  );
}

export function LevelTestIntro({
  fromLevel,
  nextTierName,
}: {
  fromLevel: number;
  nextTierName: string;
}) {
  return (
    <div className={ui.card}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        {levelTestLabel(fromLevel)}
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        About 30 questions · {nextTierName} · need 95%+ to level up
      </p>
    </div>
  );
}

export function LevelUpSuccessBanner({ newLevel }: { newLevel: number }) {
  const tier = getTierByNumber(newLevel);
  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
      Level up! You&apos;re now Level {newLevel}: {tier.name}.
    </div>
  );
}
