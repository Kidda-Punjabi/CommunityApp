import { BattleLobbyHub } from "@/components/battle/battle-lobby-hub";
import { ui } from "@/lib/ui/styles";

type BattlePageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function BattlePage({ searchParams }: BattlePageProps) {
  const { code } = await searchParams;

  return (
    <div className={ui.page}>
      <BattleLobbyHub initialJoinCode={code?.trim().toUpperCase() ?? ""} />
    </div>
  );
}
