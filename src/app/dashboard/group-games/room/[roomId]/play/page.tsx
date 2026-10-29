import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { GameLoadError } from "@/components/group-games/game-load-error";
import { GROUP_GAME_LABELS } from "@/lib/game-rooms/constants";
import { BuzzInArena } from "@/components/group-games/buzz-in-arena";
import { GameRoomPlayStub } from "@/components/group-games/game-room-play-stub";
import { JeopardyArena } from "@/components/group-games/jeopardy-arena";
import { ensureBuzzInInitialized, loadBuzzInGameState } from "@/lib/buzz-in/load-buzz-in";
import { ChadoPauriGroupArena } from "@/components/group-games/chado-pauri-group-arena";
import { SentenceBuilderGroupArena } from "@/components/group-games/sentence-builder-group-arena";
import { PointRaceArena } from "@/components/group-games/point-race-arena";
import { SoundMatchRaceArena } from "@/components/group-games/sound-match-race-arena";
import { VowelMatchRaceArena } from "@/components/group-games/vowel-match-race-arena";
import { ensureLadderInitialized, loadLadderGameState } from "@/lib/chado-pauri-group/load-ladder";
import { buildBackTextRomanisedMap } from "@/lib/chado-pauri-group/option-romanised";
import { loadChadoPauriFlashcards } from "@/lib/games/chado-pauri/load-flashcards";
import { ensureJeopardyInitialized, loadJeopardyGameState } from "@/lib/jeopardy/load-jeopardy";
import {
  ensureSentenceBuilderContinued,
  ensureSentenceBuilderInitialized,
  loadSentenceBuilderGroupState,
} from "@/lib/sentence-builder-group/load-sentence";
import { ensureRaceInitialized, loadPointRaceGameState } from "@/lib/point-race/load-race";
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

  try {
    return await renderGame(supabase, view, roomId, user.id);
  } catch (error) {
    // Let Next's own redirect / notFound signals through; anything else is a real failure.
    unstable_rethrow(error);
    console.error("[group-games] play page failed to load", { roomId, error });
    return (
      <div className={ui.page}>
        <GameLoadError
          roomId={roomId}
          isHost={view.isHost}
          gameLabel={GROUP_GAME_LABELS[view.room.game_type] ?? "Group game"}
          message={
            error instanceof Error && /topic|not enough|no grammar|no questions/i.test(error.message)
              ? error.message
              : "Something went wrong setting this game up. You can head back and pick another game."
          }
        />
      </div>
    );
  }
}

async function renderGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  view: NonNullable<Awaited<ReturnType<typeof loadGameRoomView>>>,
  roomId: string,
  userId: string
) {
  if (view.room.game_type === "buzz_in") {
    await ensureBuzzInInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const buzzState = await loadBuzzInGameState(supabase, room, userId);
    if (!buzzState) notFound();

    return (
      <div className={ui.page}>
        <BuzzInArena initialState={buzzState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "jeopardy") {
    await ensureJeopardyInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const jeopardyState = await loadJeopardyGameState(supabase, room, userId);
    if (!jeopardyState) notFound();

    return (
      <div className={ui.page}>
        <JeopardyArena initialState={jeopardyState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "chado_pauri_group") {
    await ensureLadderInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const ladderState = await loadLadderGameState(supabase, room, userId);
    if (!ladderState) notFound();

    const { cards } = await loadChadoPauriFlashcards(supabase, room.settings);
    const optionRomanisedByBackText = buildBackTextRomanisedMap(cards);

    return (
      <div className={ui.page}>
        <ChadoPauriGroupArena
          initialState={ladderState}
          initialRoom={room}
          optionRomanisedByBackText={optionRomanisedByBackText}
        />
      </div>
    );
  }

  if (view.room.game_type === "sentence_builder_group") {
    await ensureSentenceBuilderInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    await ensureSentenceBuilderContinued(supabase, room);
    const sentenceState = await loadSentenceBuilderGroupState(supabase, room, userId);
    if (!sentenceState) notFound();

    return (
      <div className={ui.page}>
        <SentenceBuilderGroupArena initialState={sentenceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "point_race") {
    await ensureRaceInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const raceState = await loadPointRaceGameState(supabase, room, userId);
    if (!raceState) notFound();

    return (
      <div className={ui.page}>
        <PointRaceArena initialState={raceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "sound_match_group") {
    await ensureRaceInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const raceState = await loadPointRaceGameState(supabase, room, userId);
    if (!raceState) notFound();

    return (
      <div className={ui.page}>
        <SoundMatchRaceArena initialState={raceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.game_type === "vowel_match_group") {
    await ensureRaceInitialized(supabase, view.room);
    const refreshedView = await loadGameRoomView(supabase, roomId, userId);
    const room = refreshedView?.room ?? view.room;
    const raceState = await loadPointRaceGameState(supabase, room, userId);
    if (!raceState) notFound();

    return (
      <div className={ui.page}>
        <VowelMatchRaceArena initialState={raceState} initialRoom={room} />
      </div>
    );
  }

  if (view.room.status !== "in_progress") {
    // A finished room with no play screen: go to the games list, not back to the
    // room page (which would send us straight here again, in a loop).
    redirect("/dashboard/group-games");
  }

  return (
    <div className={ui.page}>
      <GameRoomPlayStub gameType={view.room.game_type} roomId={roomId} />
    </div>
  );
}
