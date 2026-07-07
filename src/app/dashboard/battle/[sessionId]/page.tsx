import { notFound, redirect } from "next/navigation";
import { BattleArena } from "@/components/battle/battle-arena";
import { loadBattleSessionView } from "@/lib/battle/load-battle";
import { createClient } from "@/lib/supabase/server";

type BattleSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function BattleSessionPage({ params }: BattleSessionPageProps) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const view = await loadBattleSessionView(supabase, sessionId);
  if (!view) notFound();

  const isPlayer =
    user.id === view.session.player_one_id || user.id === view.session.player_two_id;
  if (!isPlayer) notFound();

  return (
    <BattleArena
      initialSession={{
        ...view.session,
        is_quick_match: view.session.is_quick_match ?? false,
        is_bot_opponent: view.session.is_bot_opponent ?? false,
        bot_skill: view.session.bot_skill ?? null,
      }}
      initialRound={view.currentRound}
      playerOne={view.playerOne}
      playerTwo={view.playerTwo}
      currentUserId={user.id}
      inviteCode={view.session.invite_code}
    />
  );
}
