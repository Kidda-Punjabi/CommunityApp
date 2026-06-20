import { CreateChallengeWizard } from "@/components/challenges/create-challenge-wizard";
import { loadFriends } from "@/lib/friends/load-friends";
import { loadAccessibleGameDecks } from "@/lib/games/load-game-decks";
import { createClient } from "@/lib/supabase/server";

export default async function NewChallengePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [friends, decks] = await Promise.all([
    loadFriends(supabase, user!.id),
    loadAccessibleGameDecks(supabase, user!),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <CreateChallengeWizard friends={friends} decks={decks} />
    </div>
  );
}
