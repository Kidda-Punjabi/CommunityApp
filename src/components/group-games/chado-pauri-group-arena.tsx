"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  closeRoomVotingAction,
  submitLadderAnswerAction,
  submitRoomVoteAction,
  useAskRoomAction,
  useAskTutorAction,
  useHalfHalfAction,
} from "@/app/dashboard/group-games/ladder-actions";
import { ChadoPauriLadder } from "@/components/games/chado-pauri-ladder";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { GroupGameScoreboard } from "@/components/group-games/group-game-scoreboard";
import { useLadderRealtime } from "@/hooks/use-ladder-realtime";
import { LADDER_FEEDBACK_MS, LADDER_ROOM_VOTE_WINDOW_MS } from "@/lib/chado-pauri-group/constants";
import type { LadderGameState, LadderQuestionRow, LadderRunRow } from "@/lib/chado-pauri-group/types";
import { CHADO_PAURI_RUNG_POINTS } from "@/lib/games/chado-pauri/config";
import { LIFELINE_LABELS } from "@/lib/games/chado-pauri/config";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type ChadoPauriGroupArenaProps = {
  initialState: LadderGameState;
  initialRoom: GameRoomRow;
};

const GROUP_LIFELINES = [
  { id: "half_half" as const, label: LIFELINE_LABELS.half_half },
  { id: "ask_tutor" as const, label: LIFELINE_LABELS.ask_tutor },
  { id: "ask_room" as const, label: "Ask the Room" },
];

export function ChadoPauriGroupArena({ initialState, initialRoom }: ChadoPauriGroupArenaProps) {
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [runs, setRuns] = useState(initialState.runs);
  const [activeRun, setActiveRun] = useState(initialState.activeRun);
  const [question, setQuestion] = useState(initialState.currentQuestion);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const voteCloseCalledRef = useRef(false);

  const { currentUserId } = state;
  const isHotSeat = activeRun?.player_id === currentUserId;
  const lockedInScore =
    activeRun && activeRun.current_rung > 0
      ? CHADO_PAURI_RUNG_POINTS[activeRun.current_rung - 1] ?? 0
      : 0;
  const rungIndex = activeRun?.current_rung ?? 0;

  const playerName = (userId: string) =>
    state.scoreboard.find((e) => e.userId === userId)?.displayName ?? "Player";

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

  const syncFromRun = useCallback((run: LadderRunRow) => {
    setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
    if (run.status === "active") {
      setActiveRun(run);
    } else if (activeRun?.id === run.id && run.status === "completed") {
      setActiveRun(null);
      setQuestion(null);
    }
  }, [activeRun?.id]);

  const syncQuestion = useCallback((q: LadderQuestionRow) => {
    setQuestion(q);
    if (q.resolved_at) {
      setFeedback(q.answer_correct ? "correct" : "wrong");
      window.setTimeout(() => setFeedback(null), LADDER_FEEDBACK_MS);
    }
  }, []);

  const fetchActiveQuestion = useCallback(async (runId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("game_room_ladder_questions")
      .select("*")
      .eq("run_id", runId)
      .is("resolved_at", null)
      .order("rung", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setQuestion(data as LadderQuestionRow);
  }, []);

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      setRoom(next);
      if (next.status === "completed") void refreshScoreboard();
    },
    [refreshScoreboard]
  );

  const handleRunChange = useCallback(
    (run: LadderRunRow) => {
      syncFromRun(run);
      if (run.status === "active") void fetchActiveQuestion(run.id);
      if (run.status === "completed") void refreshScoreboard();
    },
    [fetchActiveQuestion, refreshScoreboard, syncFromRun]
  );

  useLadderRealtime({
    roomId: room.id,
    activeRunId: activeRun?.id ?? null,
    activeQuestionId: question?.id ?? null,
    onRoomChange: handleRoomChange,
    onRunChange: handleRunChange,
    onQuestionChange: syncQuestion,
    onVotesChange: () => {},
    onParticipantsChange: refreshScoreboard,
  });

  useEffect(() => {
    if (!question?.ask_room_opened_at || question.room_vote_tally) return;

    voteCloseCalledRef.current = false;
    const opened = new Date(question.ask_room_opened_at).getTime();
    const msLeft = opened + LADDER_ROOM_VOTE_WINDOW_MS - Date.now();

    const fire = () => {
      if (voteCloseCalledRef.current) return;
      voteCloseCalledRef.current = true;
      startTransition(async () => {
        await closeRoomVotingAction(question.id);
      });
    };

    if (msLeft <= 0) {
      fire();
      return;
    }

    const timer = window.setTimeout(fire, msLeft + 50);
    return () => window.clearTimeout(timer);
  }, [question?.id, question?.ask_room_opened_at, question?.room_vote_tally]);

  const visibleOptions = useMemo(() => {
    if (!question) return [];
    const eliminated = new Set(question.eliminated_options ?? []);
    return question.question_payload.options.filter((opt) => !eliminated.has(opt));
  }, [question]);

  const votingOpen =
    Boolean(question?.ask_room_opened_at) && !question?.room_vote_tally && !question?.resolved_at;

  const canVote =
    votingOpen &&
    !isHotSeat &&
    state.isPlaying &&
    activeRun !== null;

  const handleAnswer = (answer: string) => {
    if (!question || !isHotSeat || pending || feedback) return;
    setError(null);
    startTransition(async () => {
      const result = await submitLadderAnswerAction(question.id, answer);
      if (result.error) setError(result.error);
    });
  };

  const handleLifeline = (id: typeof GROUP_LIFELINES[number]["id"]) => {
    if (!question || !isHotSeat || pending || feedback) return;
    setError(null);
    startTransition(async () => {
      if (id === "half_half") {
        const result = await useHalfHalfAction(question.id);
        if (result.error) setError(result.error);
      } else if (id === "ask_tutor") {
        const result = await useAskTutorAction(question.id);
        if (result.error) setError(result.error);
      } else if (id === "ask_room") {
        const result = await useAskRoomAction(question.id);
        if (result.error) setError(result.error);
      }
    });
  };

  const handleVote = (option: string) => {
    if (!question || !canVote || pending) return;
    startTransition(async () => {
      await submitRoomVoteAction(question.id, option);
    });
  };

  if (room.status === "completed") {
    return (
      <GroupGameLeaderboard
        title="Chado Pauri (Group)"
        entries={state.scoreboard}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Chado Pauri — Group
        </p>
        <h1 className="text-lg font-bold text-zinc-900">
          {activeRun
            ? `${playerName(activeRun.player_id)} is in the hot seat`
            : "Waiting for the next player…"}
          {isHotSeat ? " (you)" : ""}
        </h1>
      </div>

      <GroupGameScoreboard entries={state.scoreboard} currentUserId={currentUserId} />

      <section className={`${ui.card} space-y-2`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Turn order</p>
        <ol className="space-y-1">
          {runs.map((run) => (
            <li
              key={run.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                run.status === "active"
                  ? "bg-violet-100 font-semibold text-violet-900"
                  : run.status === "completed"
                    ? "text-zinc-400"
                    : "text-zinc-600"
              }`}
            >
              <span>
                {run.turn_order}. {playerName(run.player_id)}
                {run.player_id === currentUserId ? " (you)" : ""}
              </span>
              <span className="text-xs capitalize">{run.status}</span>
            </li>
          ))}
        </ol>
      </section>

      {activeRun && question ? (
        <>
          <ChadoPauriLadder currentRungIndex={rungIndex} lockedInScore={lockedInScore} />

          {isHotSeat ? (
            <section className={`${ui.card} space-y-3`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Lifelines
              </p>
              <div className="flex flex-wrap gap-2">
                {GROUP_LIFELINES.map((lifeline) => {
                  const used =
                    lifeline.id === "half_half"
                      ? activeRun.half_half_used
                      : lifeline.id === "ask_tutor"
                        ? activeRun.ask_tutor_used
                        : activeRun.ask_room_used;
                  return (
                    <button
                      key={lifeline.id}
                      type="button"
                      disabled={used || pending || Boolean(feedback)}
                      onClick={() => handleLifeline(lifeline.id)}
                      className={`${ui.btnSecondary} text-xs disabled:opacity-40`}
                    >
                      {lifeline.label}
                    </button>
                  );
                })}
              </div>
              {activeRun.tutor_hint ? (
                <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <span className="font-semibold">Tutor hint: </span>
                  {activeRun.tutor_hint}
                </p>
              ) : null}
              {question.room_vote_tally ? (
                <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
                  <p className="font-semibold">Ask the Room results</p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(question.room_vote_tally).map(([opt, pct]) => (
                      <li key={opt}>
                        {opt}: {pct}%
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={`${ui.card} space-y-4`}>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Rung {question.rung} · {CHADO_PAURI_RUNG_POINTS[question.rung - 1]} pts
              </p>
              <p className="mt-3 text-2xl font-bold text-zinc-900">
                {question.question_payload.prompt}
              </p>
            </div>

            {canVote ? (
              <div className="space-y-2">
                <p className="text-center text-sm font-medium text-violet-700">
                  Vote — which answer do you think is correct?
                </p>
                <div className="grid gap-2">
                  {question.question_payload.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={pending}
                      onClick={() => handleVote(option)}
                      className={`${ui.cardBordered} px-4 py-3 text-sm font-medium`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {isHotSeat && !feedback ? (
              <div className="grid gap-2">
                {visibleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={pending}
                    onClick={() => handleAnswer(option)}
                    className={`${ui.cardBordered} px-4 py-4 text-center text-lg font-semibold enabled:hover:border-violet-300 enabled:hover:bg-violet-50`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            {!isHotSeat && !canVote ? (
              <p className="text-center text-sm text-zinc-500">
                Spectating — waiting for {playerName(activeRun.player_id)} to answer…
              </p>
            ) : null}

            {feedback ? (
              <p
                className={`text-center text-sm font-semibold ${
                  feedback === "correct" ? "text-green-600" : "text-rose-600"
                }`}
              >
                {feedback === "correct" ? "Correct!" : "Wrong — run over."}
              </p>
            ) : null}
          </section>
        </>
      ) : (
        <div className={`${ui.card} py-10 text-center text-sm text-zinc-500`}>
          Preparing the next run…
        </div>
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
