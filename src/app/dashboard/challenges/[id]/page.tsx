import { ChallengeResultView } from "@/components/challenges/challenge-result-view";
import { loadFriendGameChallenge } from "@/lib/challenges/load-challenges";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type ChallengeResultPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ChallengeResultPage({ params }: ChallengeResultPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const challenge = await loadFriendGameChallenge(supabase, id);
  if (!challenge) notFound();

  if (challenge.status !== "completed") {
    if (
      challenge.yourRole === "challenger" &&
      challenge.status === "awaiting_friend"
    ) {
      redirect(`/dashboard/challenges/${id}/waiting`);
    }
    redirect("/dashboard/challenges/new");
  }

  return (
    <div className="flex flex-1 flex-col">
      <ChallengeResultView challenge={challenge} currentUserId={user!.id} />
    </div>
  );
}
