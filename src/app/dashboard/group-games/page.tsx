import { GroupGamesHub } from "@/components/group-games/group-games-hub";
import { ui } from "@/lib/ui/styles";

type GroupGamesPageProps = {
  searchParams: Promise<{ cancelled?: string; game_type?: string }>;
};

export default async function GroupGamesPage({ searchParams }: GroupGamesPageProps) {
  const { cancelled, game_type: gameType } = await searchParams;

  return (
    <div className={ui.page}>
      {cancelled === "1" ? (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The host left — this room was cancelled.
        </p>
      ) : null}
      <GroupGamesHub initialGameType={gameType} />
    </div>
  );
}
