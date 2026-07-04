import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { GROUP_GAME_LABELS } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { ui } from "@/lib/ui/styles";

type GameRoomPlayStubProps = {
  gameType: GroupGameType;
  roomId: string;
};

export function GameRoomPlayStub({ gameType, roomId }: GameRoomPlayStubProps) {
  return (
    <div className={`${ui.card} space-y-4 text-center`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Group game</p>
      <h1 className="text-2xl font-bold text-zinc-900">Game starting: {GROUP_GAME_LABELS[gameType]}</h1>
      <p className="text-sm text-zinc-500">
        The real {GROUP_GAME_LABELS[gameType]} screen will be built in a follow-up task. Everyone
        landed here together when the host started the room.
      </p>
      <p className="font-mono text-xs text-zinc-400">Room {roomId}</p>
      <Link
        href="/dashboard/group-games"
        className={`${ui.btnSecondary} w-full justify-center`}
      >
        Back to group games
      </Link>
    </div>
  );
}
