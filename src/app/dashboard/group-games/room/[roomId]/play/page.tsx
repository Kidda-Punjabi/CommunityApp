import { notFound, redirect } from "next/navigation";
import { BuzzInArena } from "@/components/group-games/buzz-in-arena";
import { GameRoomPlayStub } from "@/components/group-games/game-room-play-stub";
import { JeopardyArena } from "@/components/group-games/jeopardy-arena";
import { ensureBuzzInInitialized, loadBuzzInGameState } from "@/lib/buzz-in/load-buzz-in";
import { ChadoPauriGroupArena } from "@/components/group-games/chado-pauri-group-arena";
import { SentenceBuilderGroupArena } from "@/components/group-games/sentence-builder-group-arena";
import { PointRaceArena } from "@/components/group-games/point-race-arena";
import { ensureLadderInitialized, loadLadderGameState } from "@/lib/chado-pauri-group/load-ladder";
import { ensureJeopardyInitialized, loadJeopardyGameState } from "@/lib/jeopardy/load-jeopardy";
import {
  ensureSentenceBuilderContinued,
  ensureSentenceBuilderInitialized,
  loadSentenceBuilderGroupState,
} from "@/lib/sentence-builder-group/load-sentence";
import { ensurePointRaceInitialized, loadPointRaceGameState } from "@/lib/point-race/load-race";
import { loadGameRoomView } from "@/lib/game-rooms/load-room";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";

type GameRoomPlayPageProps = {
  params: Promise<{ roomId: string }>;
};

export default async function GameRoomPlayPage({ params }: GameRoomPlayPageProps) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const view = await loadGameRoomView(supabase, roomId, user.id);
  if (!view) notFound();

  if (view.room.status !== "in_progress" && view.room.status !== "completed") {
    redirect(`/dashboard/group-games/room/${roomId}`);
  }

  if (view.room.game_type === "buzz_in") {
    await ensureBuzzInInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, user.id);
    const room = refreshedView?.room ?? view.room;
    const buzzState = await loadBuzzInGameState(supabase, room, user.id);
    if (!buzzState) notFound();

    return (
      <div className={ui.page}>
        <BuzzInArena initialState={buzzState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "jeopardy") {
    await ensureJeopardyInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, user.id);
    const room = refreshedView?.room ?? view.room;
    const jeopardyState = await loadJeopardyGameState(supabase, room, user.id);
    if (!jeopardyState) notFound();

    return (
      <div className={ui.page}>
        <JeopardyArena initialState={jeopardyState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "chado_pauri_group") {
    await ensureLadderInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, user.id);
    const room = refreshedView?.room ?? view.room;
    const ladderState = await loadLadderGameState(supabase, room, user.id);
    if (!ladderState) notFound();

    return (
      <div className={ui.page}>
        <ChadoPauriGroupArena initialState={ladderState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "sentence_builder_group") {
    await ensureSentenceBuilderInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, user.id);
    const room = refreshedView?.room ?? view.room;
    await ensureSentenceBuilderContinued(supabase, room);
    const sentenceState = await loadSentenceBuilderGroupState(supabase, room, user.id);
    if (!sentenceState) notFound();

    return (
      <div className={ui.page}>
        <SentenceBuilderGroupArena initialState={sentenceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "point_race") {
    await ensurePointRaceInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, user.id);
    const room = refreshedView?.room ?? view.room;
    const raceState = await loadPointRaceGameState(supabase, room, user.id);
    if (!raceState) notFound();

    return (
      <div className={ui.page}>
        <PointRaceArena initialState={raceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.status !== "in_progress") {
    redirect(`/dashboard/group-games/room/${roomId}`);
  }

  return (
    <div className={ui.page}>
      <GameRoomPlayStub gameType={view.room.game_type} roomId={roomId} />
    </div>
  );
}
