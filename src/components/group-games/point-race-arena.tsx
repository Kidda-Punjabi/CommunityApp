"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { submitRaceAnswerAction } from "@/app/dashboard/group-games/race-actions";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { usePointRaceRealtime } from "@/hooks/use-point-race-realtime";
import { POINT_RACE_FEEDBACK_MS } from "@/lib/point-race/constants";
import type { PointRaceGameState, RaceStanding } from "@/lib/point-race/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type PointRaceArenaProps = {
  initialState: PointRaceGameState;
  initialRoom: GameRoomRow;
};

export function PointRaceArena({ initialState, initialRoom }: PointRaceArenaProps) {
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [myQuestion, setMyQuestion] = useState(
    initialState.myRaceState?.current_question_payload ?? null
  );
  const [standings, setStandings] = useState(initialState.standings);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackTimerRef = useRef<number | null>(null);

  const { currentUserId, isPlaying, winScore } = state;
  const winnerId =
    typeof room.settings?.winner_id === "string"
      ? room.settings.winner_id
      : state.winnerId;

  const winnerName =
    standings.find((entry) => entry.playerId === winnerId)?.displayName ??
    (winnerId === currentUserId ? "You" : "Someone");

  const refreshStandings = useCallback(async () => {
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("list_race_standings", {
      p_room_id: room.id,
    });
    if (rpcError || !data?.length) return;

    const playerIds = data.map((row: { player_id: string }) => row.player_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in("id", playerIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
    );

    setStandings(
      data.map(
        (row: {
          player_id: string;
          score: number;
          questions_answered: number;
          is_winner: boolean;
        }): RaceStanding => ({
          playerId: row.player_id,
          displayName: profileMap.get(row.player_id) ?? "Player",
          score: row.score,
          questionsAnswered: row.questions_answered,
          isWinner: row.is_winner,
        })
      )
    );
  }, [room.id]);

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      setRoom(next);
      if (next.status === "completed") void refreshStandings();
    },
    [refreshStandings]
  );

  usePointRaceRealtime({
    roomId: room.id,
    currentUserId,
    onRoomChange: handleRoomChange,
    onMyRaceStateChange: (row) => {
      setMyQuestion(row.current_question_payload);
      setState((prev) => ({
        ...prev,
        myRaceState: row,
      }));
    },
    onStandingsChange: refreshStandings,
  });

  const handleAnswer = (answer: string) => {
    if (!isPlaying || !myQuestion || pending || room.status !== "in_progress") return;

    setError(null);
    startTransition(async () => {
      const result = await submitRaceAnswerAction(answer);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.alreadyAnswered || result.gameEnded) return;

      setFeedback(result.wasCorrect ? "correct" : "wrong");
      setLastCorrectAnswer(result.correctAnswer ?? null);
      if (result.nextQuestion) setMyQuestion(result.nextQuestion);

      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setLastCorrectAnswer(null);
      }, POINT_RACE_FEEDBACK_MS);

      void refreshStandings();

      if (result.gameCompleted) {
        setRoom((prev) => ({
          ...prev,
          status: "completed",
          settings: {
            ...prev.settings,
            winner_id: result.isWinner ? currentUserId : prev.settings?.winner_id,
          },
        }));
      }
    });
  };

  const scoreboardEntries = standings.map((entry) => ({
    userId: entry.playerId,
    displayName: entry.displayName,
    score: entry.score,
  }));

  if (room.status === "completed") {
    return (
      <div className="space-y-6">
        <div className={`${ui.card} py-6 text-center`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Point Race — Game over
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">
            {winnerId === currentUserId ? "You won!" : `${winnerName} won!`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">First to {winScore} points</p>
        </div>
        <GroupGameLeaderboard
          title="Point Race"
          entries={scoreboardEntries}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Point Race
          </p>
          <h1 className="text-lg font-bold text-zinc-900">Race to {winScore} points</h1>
        </div>
        <p className="text-xs font-medium text-zinc-500">+1 per correct · your own pace</p>
      </div>

      <GroupGameScoreboard entries={scoreboardEntries} currentUserId={currentUserId} />

      {isPlaying && myQuestion ? (
        <section
          className={`${ui.card} space-y-5 ${
            feedback === "correct"
              ? "ring-2 ring-emerald-400"
              : feedback === "wrong"
                ? "ring-2 ring-rose-400"
                : ""
          }`}
        >
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Translate
            </p>
            <p className="mt-3 text-3xl font-bold leading-snug text-zinc-900">{myQuestion.prompt}</p>
          </div>

          {feedback ? (
            <p
              className={`text-center text-sm font-semibold ${
                feedback === "correct" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {feedback === "correct" ? "Correct!" : `Not quite — it was “${lastCorrectAnswer}”`}
            </p>
          ) : null}

          <div className="grid gap-3">
            {myQuestion.options.map((option) => (
              <button
                key={option}
                type="button"
                disabled={pending || feedback !== null}
                onClick={() => handleAnswer(option)}
                className={`${ui.cardBordered} w-full px-4 py-4 text-center text-lg font-semibold text-zinc-900 transition-colors enabled:hover:border-violet-300 enabled:hover:bg-violet-50 disabled:opacity-60`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {isPlaying && !myQuestion ? (
        <div className={`${ui.card} py-10 text-center text-sm text-zinc-500`}>
          Loading your question…
        </div>
      ) : null}

      {!isPlaying ? (
        <div className={`${ui.card} py-8 text-center`}>
          <p className="text-sm font-medium text-zinc-700">You&apos;re spectating</p>
          <p className="mt-1 text-sm text-zinc-500">
            Watch the leaderboard — players are racing independently.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
