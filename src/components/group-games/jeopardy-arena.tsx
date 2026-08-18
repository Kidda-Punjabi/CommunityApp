"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  claimJeopardyBuzz,
  recoverStuckJeopardyTile,
  resolveJeopardyTimeout,
  selectJeopardyTile,
  submitJeopardyAnswer,
} from "@/app/dashboard/group-games/jeopardy-actions";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { BuzzRacePanel } from "@/components/group-games/buzz-race-panel";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { useBuzzRaceTimeout } from "@/hooks/use-buzz-race-timeout";
import { useJeopardyRealtime } from "@/hooks/use-jeopardy-realtime";
import { BUZZ_RACE_ANSWER_WINDOW_MS, BUZZ_RACE_BUZZ_WINDOW_MS, BUZZ_RACE_RESULT_DELAY_MS } from "@/lib/group-games/buzz-race-constants";
import { deriveBuzzRacePhase } from "@/lib/group-games/buzz-race-types";
import {
  JEOPARDY_CATEGORIES,
  JEOPARDY_CATEGORY_LABELS,
  JEOPARDY_POINT_VALUES,
} from "@/lib/jeopardy/constants";
import type { JeopardyGameState, JeopardyTileRow, JeopardyViewMode } from "@/lib/jeopardy/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type JeopardyArenaProps = {
  initialState: JeopardyGameState;
  initialRoom: GameRoomRow;
};

function deriveViewMode(
  activeTile: JeopardyTileRow | null,
  roomStatus: string,
  showResult: boolean
): JeopardyViewMode {
  if (roomStatus === "completed") return "board";
  if (!activeTile) return "board";
  if (showResult || activeTile.resolved_at) return "result";
  return "question";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tileWindowElapsed(tile: JeopardyTileRow): boolean {
  if (!tile.opened_at || tile.resolved_at || tile.status !== "active") return false;
  if (tile.buzzed_by && tile.buzzed_at) {
    return Date.now() >= new Date(tile.buzzed_at).getTime() + BUZZ_RACE_ANSWER_WINDOW_MS;
  }
  return Date.now() >= new Date(tile.opened_at).getTime() + BUZZ_RACE_BUZZ_WINDOW_MS;
}

export function JeopardyArena({ initialState, initialRoom }: JeopardyArenaProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [tiles, setTiles] = useState(initialState.tiles);
  const [activeTile, setActiveTile] = useState<JeopardyTileRow | null>(initialState.activeTile);
  const [showResult, setShowResult] = useState(false);
  const [buzzerName, setBuzzerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [stuckVisible, setStuckVisible] = useState(false);
  const resultTimerRef = useRef<number | null>(null);
  const resultTileIdRef = useRef<string | null>(null);
  const activeTileRef = useRef<JeopardyTileRow | null>(initialState.activeTile);
  const loadBoardRef = useRef<() => Promise<void>>(async () => undefined);
  activeTileRef.current = activeTile;

  const { currentUserId, isPlaying, currentPickerId } = {
    ...state,
    currentPickerId: room.current_picker_id ?? state.currentPickerId,
  };

  const isHost = room.host_id === currentUserId;
  const isPicker = currentPickerId === currentUserId;
  const viewMode = deriveViewMode(activeTile, room.status, showResult);
  const buzzPhase = deriveBuzzRacePhase(activeTile, room.status);
  const isBuzzer = activeTile?.buzzed_by === currentUserId;
  const question = activeTile?.question_payload;

  const pickerName =
    state.scoreboard.find((e) => e.userId === currentPickerId)?.displayName ?? "Someone";

  const refreshScoreboard = useCallback(async () => {
    const supabase = createClient();
    const { data: participants } = await supabase
      .from("game_room_participants")
      .select("user_id, score, is_playing, is_host")
      .eq("room_id", room.id)
      .is("left_at", null)
      .order("score", { ascending: false });

    if (!participants?.length) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in(
        "id",
        participants.map((p) => p.user_id)
      );

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
    );

    setState((prev) => ({
      ...prev,
      scoreboard: participants.map((p) => ({
        userId: p.user_id,
        displayName: profileMap.get(p.user_id) ?? "Player",
        score: p.score,
        isPlaying: p.is_playing,
        isHost: p.is_host,
      })),
    }));
  }, [room.id]);

  const loadBuzzerName = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name, preferred_name")
      .eq("id", userId)
      .maybeSingle();
    setBuzzerName(getDisplayName(data) ?? "Someone");
  }, []);

  const applyTile = useCallback(
    (next: JeopardyTileRow) => {
      setTiles((prev) => prev.map((t) => (t.id === next.id ? next : t)));

      if (next.status === "active") {
        if (resultTimerRef.current) {
          window.clearTimeout(resultTimerRef.current);
          resultTimerRef.current = null;
          resultTileIdRef.current = null;
        }
        setActiveTile(next);
        setShowResult(false);
        if (next.buzzed_by) void loadBuzzerName(next.buzzed_by);
        else setBuzzerName(null);
      }

      if (next.status === "resolved" && next.resolved_at) {
        setActiveTile(next);
        setShowResult(true);
        void refreshScoreboard();
        if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
        resultTileIdRef.current = next.id;
        resultTimerRef.current = window.setTimeout(() => {
          resultTimerRef.current = null;
          if (resultTileIdRef.current !== next.id) return;
          resultTileIdRef.current = null;
          setActiveTile(null);
          setShowResult(false);
        }, BUZZ_RACE_RESULT_DELAY_MS);
      }
    },
    [loadBuzzerName, refreshScoreboard]
  );

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      setRoom(next);
      setState((prev) => ({
        ...prev,
        currentPickerId: next.current_picker_id ?? prev.currentPickerId,
        roomStatus: next.status as JeopardyGameState["roomStatus"],
      }));
      if (next.status === "lobby") {
        router.push(`/dashboard/group-games/room/${next.id}`);
        return;
      }
      if (next.status === "completed") {
        void refreshScoreboard();
      }
    },
    [refreshScoreboard, router]
  );

  const handleTileChange = useCallback(
    (next: JeopardyTileRow) => {
      applyTile(next);
    },
    [applyTile]
  );

  const loadBoardFromServer = useCallback(async () => {
    const supabase = createClient();
    const [{ data: roomRow }, { data: tileRows }] = await Promise.all([
      supabase.from("game_rooms").select("*").eq("id", room.id).maybeSingle(),
      supabase.from("game_room_jeopardy_tiles").select("*").eq("room_id", room.id),
    ]);

    if (roomRow) handleRoomChange(roomRow as GameRoomRow);
    if (!tileRows?.length) return;

    const nextTiles = tileRows as JeopardyTileRow[];
    setTiles(nextTiles);
    const active = nextTiles.find((t) => t.status === "active") ?? null;
    if (active) {
      applyTile(active);
      return;
    }
    if (!resultTileIdRef.current) {
      setActiveTile(null);
      setShowResult(false);
    }
  }, [applyTile, handleRoomChange, room.id]);
  loadBoardRef.current = loadBoardFromServer;

  const handleTimeout = useCallback(async (tileId: string) => {
    const started = Date.now();
    while (Date.now() - started < 20_000) {
      const result = await resolveJeopardyTimeout(tileId);
      if (result.tooEarly) {
        await sleep(400);
        continue;
      }
      if (result.error) {
        await sleep(800);
        continue;
      }
      return;
    }
  }, []);

  const handleResync = useCallback(() => {
    if (resultTileIdRef.current) return;
    void loadBoardFromServer();
  }, [loadBoardFromServer]);

  useJeopardyRealtime({
    roomId: room.id,
    onRoomChange: handleRoomChange,
    onTileChange: handleTileChange,
    onParticipantsChange: refreshScoreboard,
    onResync: handleResync,
  });

  useBuzzRaceTimeout({
    itemId: activeTile?.id ?? null,
    openedAt: activeTile?.opened_at ?? null,
    buzzedAt: activeTile?.buzzed_at ?? null,
    buzzedBy: activeTile?.buzzed_by ?? null,
    resolvedAt: activeTile?.resolved_at ?? null,
    enabled:
      room.status === "in_progress" &&
      activeTile?.status === "active" &&
      !activeTile.resolved_at,
    onTimeout: handleTimeout,
  });

  useEffect(() => {
    if (room.status !== "in_progress") return;
    const tick = () => {
      void loadBoardRef.current();
      const current = activeTileRef.current;
      if (current && tileWindowElapsed(current)) {
        void resolveJeopardyTimeout(current.id);
      }
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => window.clearInterval(timer);
  }, [room.id, room.status]);

  useEffect(() => {
    const current = activeTile;
    if (!current?.opened_at || current.resolved_at || current.status !== "active") {
      setStuckVisible(false);
      return;
    }
    const check = () => setStuckVisible(tileWindowElapsed(current));
    check();
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [
    activeTile?.id,
    activeTile?.opened_at,
    activeTile?.buzzed_at,
    activeTile?.buzzed_by,
    activeTile?.resolved_at,
    activeTile?.status,
  ]);

  useEffect(() => {
    return () => {
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTile?.buzzed_by) void loadBuzzerName(activeTile.buzzed_by);
  }, [activeTile?.buzzed_by, loadBuzzerName]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBoardFromServer();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadBoardFromServer]);

  const handleSelectTile = (tileId: string) => {
    if (!isPicker || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await selectJeopardyTile(tileId);
      if (result.error) setError(result.error);
    });
  };

  const handleBuzz = () => {
    if (!activeTile || !isPlaying || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await claimJeopardyBuzz(activeTile.id);
      if (result.error) setError(result.error);
      else if (!result.claimed && result.buzzedBy) void loadBuzzerName(result.buzzedBy);
    });
  };

  const handleAnswer = (answer: string) => {
    if (!activeTile || !isBuzzer || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await submitJeopardyAnswer(activeTile.id, answer);
      if (result.error) setError(result.error);
    });
  };

  const handleRecoverStuckTile = () => {
    if (!activeTile || !isHost || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await recoverStuckJeopardyTile(activeTile.id);
      if (result.tooEarly) setError(result.error ?? "Tile is still in progress.");
      else if (result.error) setError(result.error);
      else void loadBoardFromServer();
    });
  };

  const buzzerDisplayName =
    buzzerName ??
    state.scoreboard.find((e) => e.userId === activeTile?.buzzed_by)?.displayName ??
    "Someone";

  const finished = room.status === "completed";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Jeopardy</p>
          <h1 className="text-lg font-bold text-zinc-900">
            {finished
              ? "Game over"
              : isPicker
                ? "Your turn — pick a tile"
                : `Waiting for ${pickerName} to choose a tile`}
          </h1>
        </div>
        <GameTutorialHost tutorialId="jeopardy" />
      </div>

      {finished ? (
        <GroupGameLeaderboard
          title="Jeopardy"
          entries={state.scoreboard}
          currentUserId={currentUserId}
          roomId={room.id}
          isHost={isHost}
          currentGameType="jeopardy"
        />
      ) : (
        <>
          <GroupGameScoreboard entries={state.scoreboard} currentUserId={currentUserId} />

          {state.skippedTiles.length > 0 ? (
            <p className="text-xs text-amber-700">
              {state.skippedTiles.length} tile(s) skipped — missing flashcards for some slots.
            </p>
          ) : null}

          <section className={`${ui.card} overflow-x-auto`}>
            <div className="min-w-[20rem]">
              <div className="grid grid-cols-4 gap-2">
                <div />
                {JEOPARDY_CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="py-2 text-center text-xs font-bold uppercase tracking-wider text-violet-700"
                  >
                    {JEOPARDY_CATEGORY_LABELS[cat]}
                  </div>
                ))}

                {JEOPARDY_POINT_VALUES.map((points) => (
                  <div key={`row-${points}`} className="contents">
                    <div className="flex items-center justify-end pr-2 text-xs font-semibold text-zinc-500">
                      {points}
                    </div>
                    {JEOPARDY_CATEGORIES.map((cat) => {
                      const tile = tiles.find(
                        (t) => t.category === cat && t.point_value === points
                      );
                      if (!tile) {
                        return (
                          <div
                            key={`${cat}-${points}`}
                            className="flex h-14 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400"
                          >
                            —
                          </div>
                        );
                      }

                      const spent = tile.status === "resolved";
                      const active = tile.status === "active";
                      const selectable =
                        isPicker && tile.status === "unopened" && !activeTile;

                      return (
                        <button
                          key={tile.id}
                          type="button"
                          disabled={!selectable || pending}
                          onClick={() => handleSelectTile(tile.id)}
                          className={`flex h-14 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                            spent
                              ? "bg-zinc-200 text-zinc-400 line-through decoration-zinc-400"
                              : active
                                ? "bg-violet-600 text-white ring-2 ring-violet-300"
                                : selectable
                                  ? "bg-violet-100 text-violet-800 hover:bg-violet-200"
                                  : "cursor-default bg-violet-50 text-violet-400"
                          }`}
                        >
                          {points}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {activeTile && question && (viewMode === "question" || viewMode === "result") ? (
            <BuzzRacePanel
              question={question}
              phase={buzzPhase}
              isPlaying={isPlaying}
              isBuzzer={isBuzzer}
              buzzerDisplayName={buzzerDisplayName}
              buzzedBy={activeTile.buzzed_by}
              answerCorrect={activeTile.answer_correct}
              pending={pending}
              onBuzz={handleBuzz}
              onAnswer={handleAnswer}
            />
          ) : null}

          {isHost && stuckVisible && activeTile ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRecoverStuckTile}
                disabled={pending}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-60"
              >
                Recover stuck tile
              </button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </>
      )}
    </div>
  );
}
