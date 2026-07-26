"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRaceAnswerAction } from "@/app/dashboard/group-games/race-actions";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { ChadoPauriGroupOptionLabel } from "@/components/group-games/chado-pauri-group-option-label";
import { McqOptionLabel } from "@/components/group-games/mcq-option-label";
import { usePointRaceRealtime } from "@/hooks/use-point-race-realtime";
import { POINT_RACE_FEEDBACK_MS } from "@/lib/point-race/constants";
import type { PointRaceGameState, RaceStanding } from "@/lib/point-race/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

const PENDING_MS = 2000;

type PointRaceArenaProps = {
  initialState: PointRaceGameState;
  initialRoom: GameRoomRow;
};

export function PointRaceArena({ initialState, initialRoom }: PointRaceArenaProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [myQuestion, setMyQuestion] = useState(
    initialState.myRaceState?.current_question_payload ?? null
  );
  const [standings, setStandings] = useState(initialState.standings);
  const [feedback, setFeedback] = useState<"pending" | "correct" | "wrong" | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackTimerRef = useRef<number | null>(null);

  const { currentUserId, isPlaying, winScore } = state;
  const isHost = room.host_id === currentUserId;
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
    if (rpcError || !data) return;

    const rows = data as Array<{
      player_id: string;
      score: number;
      questions_answered: number;
      is_winner: boolean;
    }>;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name")
      .in(
        "id",
        rows.map((row) => row.player_id)
      );

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Player"])
    );

    setStandings(
      rows.map(
        (row): RaceStanding => ({
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
      if (next.status === "lobby") {
        router.push(`/dashboard/group-games/room/${next.id}`);
        return;
      }
      if (next.status === "completed") void refreshStandings();
    },
    [refreshStandings, router]
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

  const handleSelect = (answer: string) => {
    if (!isPlaying || !myQuestion || pending || feedback || room.status !== "in_progress") {
      return;
    }
    setError(null);
    setSelectedAnswer(answer);
  };

  const handleSubmit = () => {
    if (
      !selectedAnswer ||
      !isPlaying ||
      !myQuestion ||
      pending ||
      feedback ||
      room.status !== "in_progress"
    ) {
      return;
    }

    const answer = selectedAnswer;
    setFeedback("pending");

    startTransition(async () => {
      await new Promise((r) => setTimeout(r, PENDING_MS));

      const result = await submitRaceAnswerAction(answer);

      if (result.error) {
        setError(result.error);
        setFeedback(null);
        setSelectedAnswer(null);
        return;
      }

      if (result.alreadyAnswered || result.gameEnded) {
        setFeedback(null);
        setSelectedAnswer(null);
        return;
      }

      setFeedback(result.wasCorrect ? "correct" : "wrong");
      setLastCorrectAnswer(result.correctAnswer ?? null);

      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setSelectedAnswer(null);
        setLastCorrectAnswer(null);
        if (result.nextQuestion) setMyQuestion(result.nextQuestion);
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

  const finished = room.status === "completed";
  const lastCorrectIndex =
    lastCorrectAnswer && myQuestion ? myQuestion.options.indexOf(lastCorrectAnswer) : -1;
  const lastCorrectRomanised =
    lastCorrectIndex >= 0 ? (myQuestion?.options_romanised?.[lastCorrectIndex] ?? null) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Point Race{finished ? " — Game over" : ""}
          </p>
          <h1 className="text-lg font-bold text-zinc-900">
            {finished
              ? winnerId === currentUserId
                ? "You won!"
                : `${winnerName} won!`
              : `Race to ${winScore} points`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!finished ? (
            <p className="text-xs font-medium text-zinc-500">+1 per correct · your own pace</p>
          ) : (
            <p className="text-xs font-medium text-zinc-500">First to {winScore}</p>
          )}
          <GameTutorialHost tutorialId="point_race" />
        </div>
      </div>

      {finished ? (
        <GroupGameLeaderboard
          title="Point Race"
          entries={scoreboardEntries}
          currentUserId={currentUserId}
          roomId={room.id}
          isHost={isHost}
          currentGameType="point_race"
        />
      ) : (
        <>
          <GroupGameScoreboard entries={scoreboardEntries} currentUserId={currentUserId} />

          {isPlaying && myQuestion ? (
            <section
              className={`${ui.card} space-y-5 ${
                feedback === "correct"
                  ? "ring-2 ring-emerald-400"
                  : feedback === "wrong"
                    ? "ring-2 ring-rose-400"
                    : feedback === "pending"
                      ? "ring-2 ring-amber-400"
                      : ""
              }`}
            >
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Translate
                </p>
                <p className="mt-3 text-3xl font-bold leading-snug text-zinc-900">
                  {myQuestion.prompt}
                </p>
              </div>

              {feedback && feedback !== "pending" ? (
                <div
                  className={`text-center text-sm font-semibold ${
                    feedback === "correct" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {feedback === "correct" ? (
                    "Correct!"
                  ) : (
                    <span className="inline-flex flex-wrap items-center justify-center gap-1">
                      Not quite — it was{" "}
                      <ChadoPauriGroupOptionLabel
                        gurmukhi={lastCorrectAnswer ?? ""}
                        romanised={lastCorrectRomanised}
                      />
                    </span>
                  )}
                </div>
              ) : null}

              {feedback === "pending" ? (
                <p className="text-center text-sm font-semibold text-amber-700">Checking…</p>
              ) : null}

              <div className="grid gap-3">
                {myQuestion.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={pending || feedback !== null}
                      onClick={() => handleSelect(option)}
                      className={`${ui.cardBordered} w-full px-4 py-4 text-center text-lg transition-colors disabled:opacity-90 ${
                        feedback === "pending" && isSelected
                          ? "border-amber-400 bg-amber-50"
                          : feedback === "correct" && isSelected
                            ? "border-emerald-500 bg-emerald-50"
                            : feedback === "wrong" && isSelected
                              ? "border-rose-500 bg-rose-50"
                              : isSelected
                                ? "border-2 border-violet-600 bg-violet-50"
                                : "enabled:hover:border-violet-300 enabled:hover:bg-violet-50"
                      }`}
                    >
                      <McqOptionLabel question={myQuestion} option={option} />
                    </button>
                  );
                })}
              </div>

              {!feedback ? (
                <button
                  type="button"
                  disabled={!selectedAnswer || pending}
                  onClick={handleSubmit}
                  className={ui.btnPrimaryBlock}
                >
                  Submit answer
                </button>
              ) : null}
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
        </>
      )}
    </div>
  );
}
