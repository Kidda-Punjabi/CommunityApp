import { BattleLobbyHub } from "@/components/battle/battle-lobby-hub";
import { ui } from "@/lib/ui/styles";

type BattlePageProps = {
  searchParams: Promise<{ code?: string; game_source?: string }>;
};

export default async function BattlePage({ searchParams }: BattlePageProps) {
  const { code, game_source: gameSource } = await searchParams;

  return (
    <div className={ui.page}>
      <BattleLobbyHub
        initialJoinCode={code?.trim().toUpperCase() ?? ""}
        initialGameSource={gameSource}
      />
    </div>
  );
}
