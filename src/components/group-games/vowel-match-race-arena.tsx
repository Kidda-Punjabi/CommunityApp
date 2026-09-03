"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitVowelMatchRaceAnswerAction } from "@/app/dashboard/group-games/race-actions";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { usePointRaceRealtime } from "@/hooks/use-point-race-realtime";
import {
  encodeVowelAnswer,
  isVowelMatchId,
  vowelMatchLabel,
  type VowelMatchId,
} from "@/lib/games/vowel-match";
import {
  isVowelMatchRacePayload,
  type VowelMatchRacePayload,
} from "@/lib/games/vowel-match-race";
import type { PointRaceGameState, RaceStanding } from "@/lib/point-race/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { Volume2 } from "lucide-react";

const FEEDBACK_MS = 1400;

type VowelMatchRaceArenaProps = {
  initialState: PointRaceGameState;
  initialRoom: GameRoomRow;
};

function payloadFromUnknown(value: unknown): VowelMatchRacePayload | null {
  return isVowelMatchRacePayload(value) ? value : null;
}

export function VowelMatchRaceArena({ initialState, initialRoom }: VowelMatchRaceArenaProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [myQuestion, setMyQuestion] = useState<VowelMatchRacePayload | null>(
    payloadFromUnknown(initialState.myRaceState?.current_question_payload)
  );
  const [standings, setStandings] = useState(initialState.standings);
  const [selected, setSelected] = useState<VowelMatchId[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { currentUserId, isPlaying, winScore } = state;
  const isHost = room.host_id === currentUserId;
  const winnerId =
    typeof room.settings?.winner_id === "string" ? room.settings.winner_id : state.winnerId;
  const winnerName =
    standings.find((entry) => entry.playerId === winnerId)?.displayName ??
    (winnerId === currentUserId ? "You" : "Someone");

  const playCurrentAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !myQuestion?.audio_url) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [myQuestion?.audio_url]);

  useEffect(() => {
    setSelected([]);
    setFeedback(null);
    playCurrentAudio();
  }, [myQuestion?.question_id, playCurrentAudio]);

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
      const next = payloadFromUnknown(row.current_question_payload);
      if (next) setMyQuestion(next);
      setState((prev) => ({ ...prev, myRaceState: row }));
    },
    onStandingsChange: refreshStandings,
  });

  function toggleOption(id: VowelMatchId) {
    if (!isPlaying || pending || feedback || room.status !== "in_progress") return;
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function submitAnswer() {
    if (!myQuestion || selected.length === 0 || pending || feedback) return;

    startTransition(async () => {
      const result = await submitVowelMatchRaceAnswerAction(encodeVowelAnswer(selected));
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.alreadyAnswered || result.gameEnded) return;

      setFeedback({ isCorrect: Boolean(result.wasCorrect) });
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setSelected([]);
        const next = payloadFromUnknown(result.nextQuestion);
        if (next) setMyQuestion(next);
      }, FEEDBACK_MS);

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
  }

  const scoreboardEntries = standings.map((entry) => ({
    userId: entry.playerId,
    displayName: entry.displayName,
    score: entry.score,
  }));
  const finished = room.status === "completed";
  const correctIds = myQuestion
    ? myQuestion.correct_answer.split(",").filter(isVowelMatchId)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Vowel Match{finished ? " — Game over" : ""}
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
          <p className="text-xs font-medium text-zinc-500">+1 per exact set · your own pace</p>
          <GameTutorialHost tutorialId="vowel_match_group" />
        </div>
      </div>

      {finished ? (
        <GroupGameLeaderboard
          title="Vowel Match"
          entries={scoreboardEntries}
          currentUserId={currentUserId}
          roomId={room.id}
          isHost={isHost}
          currentGameType="vowel_match_group"
        />
      ) : (
        <>
          <GroupGameScoreboard entries={scoreboardEntries} currentUserId={currentUserId} />

          {isPlaying && myQuestion ? (
            <section className={`${ui.card} space-y-5`}>
              <audio ref={audioRef} src={myQuestion.audio_url} preload="auto" />
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Which vowel(s) do you hear?
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Select every matra, then submit. Replay as needed.
                </p>
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={playCurrentAudio} className={ui.btnSecondary}>
                    <Volume2 className="mr-2 h-4 w-4" aria-hidden />
                    Replay
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {myQuestion.options.filter(isVowelMatchId).map((option) => {
                  const isChosen = selected.includes(option);
                  const isCorrectOption = correctIds.includes(option);
                  const showResult = feedback !== null;
                  let className =
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ";
                  if (showResult) {
                    if (isCorrectOption) className += "border-emerald-400 bg-emerald-50";
                    else if (isChosen) className += "border-rose-300 bg-rose-50";
                    else className += "border-zinc-200 bg-white opacity-60";
                  } else if (isChosen) {
                    className += "border-violet-400 bg-violet-50";
                  } else {
                    className += "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40";
                  }
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={pending || showResult}
                      onClick={() => toggleOption(option)}
                      className={className}
                    >
                      <span className="font-semibold text-zinc-900">{vowelMatchLabel(option)}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={submitAnswer}
                disabled={Boolean(feedback) || pending || selected.length === 0}
                className={ui.btnPrimaryBlock}
              >
                Submit
              </button>

              {feedback ? (
                <p
                  className={`text-center text-sm font-semibold ${
                    feedback.isCorrect ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {feedback.isCorrect
                    ? "Correct!"
                    : `Not quite — ${correctIds.map(vowelMatchLabel).join(", ")}`}
                </p>
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
