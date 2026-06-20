"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { challengeResultHref } from "@/lib/challenges/config";
import { submitFriendGameChallengeScore } from "@/lib/challenges/submit-score";
import type { ChallengeSubmitResult } from "@/lib/challenges/types";

type UseChallengeFinishOptions = {
  challengeId?: string;
  score: number;
  scoreMetadata: Record<string, unknown>;
  enabled: boolean;
};

export function useChallengeFinish({
  challengeId,
  score,
  scoreMetadata,
  enabled,
}: UseChallengeFinishOptions) {
  const router = useRouter();
  const [result, setResult] = useState<ChallengeSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!enabled || !challengeId || submitting || result || error) return;

    setSubmitting(true);
    const supabase = createClient();

    submitFriendGameChallengeScore(supabase, challengeId, score, scoreMetadata)
      .then((outcome) => {
        setResult(outcome);
        if (outcome.status === "completed" && challengeId) {
          router.push(challengeResultHref(challengeId));
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [enabled, challengeId, score, scoreMetadata, submitting, result, error, router]);

  return { result, error, submitting };
}
