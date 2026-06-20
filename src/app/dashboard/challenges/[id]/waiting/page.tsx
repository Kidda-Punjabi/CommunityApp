import { ChallengeWaitingView } from "@/components/challenges/challenge-waiting-view";
import { loadFriendGameChallenge } from "@/lib/challenges/load-challenges";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type ChallengeWaitingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChallengeWaitingPage({ params }: ChallengeWaitingPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const challenge = await loadFriendGameChallenge(supabase, id);
  if (!challenge) notFound();

  if (challenge.status === "completed") {
    redirect(`/dashboard/challenges/${id}`);
  }

  if (
    challenge.yourRole !== "challenger" ||
    challenge.status !== "awaiting_friend"
  ) {
    redirect("/dashboard/challenges/new");
  }

  return (
    <div className="flex flex-1 flex-col">
      <ChallengeWaitingView challenge={challenge} />
    </div>
  );
}
