"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSoundMatchRaceAnswerAction } from "@/app/dashboard/group-games/race-actions";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { usePointRaceRealtime } from "@/hooks/use-point-race-realtime";
import { letterLabel } from "@/lib/games/sound-match";
import {
  isSoundMatchRacePayload,
  type SoundMatchRacePayload,
} from "@/lib/games/sound-match-race";
import type { PointRaceGameState, RaceStanding } from "@/lib/point-race/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { Volume2 } from "lucide-react";

const FEEDBACK_MS = 1100;

type SoundMatchRaceArenaProps = {
  initialState: PointRaceGameState;
  initialRoom: GameRoomRow;
};

function payloadFromUnknown(value: unknown): SoundMatchRacePayload | null {
  return isSoundMatchRacePayload(value) ? value : null;
}

export function SoundMatchRaceArena({ initialState, initialRoom }: SoundMatchRaceArenaProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [myQuestion, setMyQuestion] = useState<SoundMatchRacePayload | null>(
    payloadFromUnknown(initialState.myRaceState?.current_question_payload)
  );
  const [standings, setStandings] = useState(initialState.standings);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    selected: string;
    questionId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feedbackTimerRef = useRef<number | null>(null);
  const feedbackLockRef = useRef(false);
  const pendingQuestionRef = useRef<SoundMatchRacePayload | null>(null);
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
    if (!feedback) playCurrentAudio();
  }, [myQuestion?.question_id, playCurrentAudio, feedback]);

  function applyNextQuestion(next: SoundMatchRacePayload | null) {
    if (!next) return;
    feedbackLockRef.current = false;
    pendingQuestionRef.current = null;
    setFeedback(null);
    setMyQuestion(next);
  }

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
      if (next) {
        if (feedbackLockRef.current) {
          pendingQuestionRef.current = next;
        } else {
          setMyQuestion((prev) => (prev?.question_id === next.question_id ? prev : next));
        }
      }
      setState((prev) => ({ ...prev, myRaceState: row }));
    },
    onStandingsChange: refreshStandings,
  });

  function chooseOption(option: string) {
    if (!isPlaying || !myQuestion || pending || feedback || room.status !== "in_progress") {
      return;
    }
    const answeredQuestionId = myQuestion.question_id;

    startTransition(async () => {
      const result = await submitSoundMatchRaceAnswerAction(option);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.alreadyAnswered || result.gameEnded) return;

      feedbackLockRef.current = true;
      setFeedback({
        isCorrect: Boolean(result.wasCorrect),
        selected: option,
        questionId: answeredQuestionId,
      });
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        applyNextQuestion(
          payloadFromUnknown(result.nextQuestion) ?? pendingQuestionRef.current
        );
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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Sound Match{finished ? " — Game over" : ""}
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
          <p className="text-xs font-medium text-zinc-500">+1 per correct · your own pace</p>
          <GameTutorialHost tutorialId="sound_match_group" />
        </div>
      </div>

      {finished ? (
        <GroupGameLeaderboard
          title="Sound Match"
          entries={scoreboardEntries}
          currentUserId={currentUserId}
          roomId={room.id}
          isHost={isHost}
          currentGameType="sound_match_group"
        />
      ) : (
        <>
          <GroupGameScoreboard entries={scoreboardEntries} currentUserId={currentUserId} />

          {isPlaying && myQuestion ? (
            <section className={`${ui.card} space-y-5`}>
              {myQuestion.audio_url ? (
                <audio ref={audioRef} src={myQuestion.audio_url} preload="auto" />
              ) : null}
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Which letter do you hear?
                </p>
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={playCurrentAudio} className={ui.btnSecondary}>
                    <Volume2 className="mr-2 h-4 w-4" aria-hidden />
                    Replay
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {myQuestion.options.map((option) => {
                  const showResult =
                    feedback !== null && feedback.questionId === myQuestion.question_id;
                  const isCorrectOption = option === myQuestion.correct_answer;
                  const isChosen = feedback?.selected === option;
                  let className = `${ui.cardBordered} w-full px-4 py-4 text-left text-lg `;
                  if (showResult) {
                    if (isCorrectOption) className += "border-emerald-500 bg-emerald-50";
                    else if (isChosen) className += "border-rose-500 bg-rose-50";
                    else className += "opacity-60";
                  } else {
                    className += "enabled:hover:border-violet-300 enabled:hover:bg-violet-50";
                  }
                  return (
                    <button
                      key={`${myQuestion.question_id}-${option}`}
                      type="button"
                      disabled={pending || showResult}
                      onClick={() => chooseOption(option)}
                      className={className}
                    >
                      {letterLabel(option)}
                    </button>
                  );
                })}
              </div>

              {feedback && feedback.questionId === myQuestion.question_id ? (
                <p
                  className={`text-center text-sm font-semibold ${
                    feedback.isCorrect ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {feedback.isCorrect
                    ? "Correct!"
                    : `Not quite — ${letterLabel(myQuestion.correct_answer)}`}
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
