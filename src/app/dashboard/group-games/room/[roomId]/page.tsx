import { notFound, redirect } from "next/navigation";
import { GameRoomLobby } from "@/components/group-games/game-room-lobby";
import { loadGameRoomView } from "@/lib/game-rooms/load-room";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type GameRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function GameRoomPage({ params }: GameRoomPageProps) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const view = await loadGameRoomView(supabase, roomId, user.id);
  if (!view) notFound();

  if (view.room.status === "in_progress") {
    redirect(`/dashboard/group-games/room/${roomId}/play`);
  }

  if (view.room.status === "cancelled" || view.room.status === "completed") {
    redirect("/dashboard/group-games?cancelled=1");
  }

  return (
    <div className={ui.page}>
      <GameRoomLobby initialView={view} />
    </div>
  );
}
