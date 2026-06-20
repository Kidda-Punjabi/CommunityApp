"use client";

import Link from "next/link";
import type { ChallengeSubmitResult } from "@/lib/challenges/types";

type ChallengePostGameBannerProps = {
  opponentName: string;
  result: ChallengeSubmitResult | null;
  error: string | null;
  submitting: boolean;
};

export function ChallengePostGameBanner({
  opponentName,
  result,
  error,
  submitting,
}: ChallengePostGameBannerProps) {
  if (submitting) {
    return (
      <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-800">
        Submitting your challenge score…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (result?.status === "awaiting_friend") {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">Challenge sent!</p>
        <p className="mt-1 text-sm text-emerald-800">
          Your score is in. We&apos;ve notified {opponentName} — you&apos;ll get a notification
          when they play and we&apos;ll show who won.
        </p>
        <Link
          href="/dashboard/home"
          className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return null;
}
