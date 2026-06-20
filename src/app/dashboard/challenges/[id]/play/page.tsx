import { challengePlayHref } from "@/lib/challenges/config";
import {
  canPlayChallenge,
  loadFriendGameChallenge,
} from "@/lib/challenges/load-challenges";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type ChallengePlayRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChallengePlayRedirectPage({
  params,
}: ChallengePlayRedirectPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const challenge = await loadFriendGameChallenge(supabase, id);

  if (!challenge) notFound();

  if (challenge.status === "completed") {
    redirect(`/dashboard/challenges/${id}`);
  }

  if (
    challenge.yourRole === "challenger" &&
    challenge.status === "awaiting_friend"
  ) {
    redirect(`/dashboard/challenges/${id}/waiting`);
  }

  if (!canPlayChallenge(challenge)) {
    redirect("/dashboard/challenges/new");
  }

  redirect(challengePlayHref(challenge.id, challenge.gameType, challenge.config));
}
