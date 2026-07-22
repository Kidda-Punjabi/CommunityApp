"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  submitLadderAnswerAction,
  useAskRoomAction,
  useAskTutorAction,
  useHalfHalfAction,
} from "@/app/dashboard/group-games/ladder-actions";
import { AskRoomAudienceChart } from "@/components/group-games/ask-room-audience-chart";
import { ChadoPauriGroupOptionLabel } from "@/components/group-games/chado-pauri-group-option-label";
import { ChadoPauriGroupPlayerChips } from "@/components/group-games/chado-pauri-group-player-chips";
import { ChadoPauriLadder } from "@/components/games/chado-pauri-ladder";
import { GroupGameLeaderboard } from "@/components/group-games/group-game-leaderboard";
import { useLadderRealtime } from "@/hooks/use-ladder-realtime";
import {
  LADDER_FEEDBACK_MS,
  ladderAskRoomUsesRemaining,
} from "@/lib/chado-pauri-group/constants";
import { resolveOptionRomanised } from "@/lib/chado-pauri-group/option-romanised";
import type { LadderGameState, LadderQuestionRow, LadderRunRow } from "@/lib/chado-pauri-group/types";
import { CHADO_PAURI_RUNG_POINTS } from "@/lib/games/chado-pauri/config";
import { LIFELINE_LABELS } from "@/lib/games/chado-pauri/config";
import { getDisplayName } from "@/lib/profile/display-name";
import type { GameRoomRow } from "@/lib/game-rooms/types";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

type ChadoPauriGroupArenaProps = {
  initialState: LadderGameState;
  initialRoom: GameRoomRow;
  optionRomanisedByBackText: Record<string, string>;
};

export function ChadoPauriGroupArena({
  initialState,
  initialRoom,
  optionRomanisedByBackText,
}: ChadoPauriGroupArenaProps) {
  const [room, setRoom] = useState(initialRoom);
  const [state, setState] = useState(initialState);
  const [runs, setRuns] = useState(initialState.runs);
  const [activeRun, setActiveRun] = useState(initialState.activeRun);
  const [question, setQuestion] = useState(initialState.currentQuestion);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeRunIdRef = useRef(activeRun?.id ?? null);

  useEffect(() => {
    activeRunIdRef.current = activeRun?.id ?? null;
  }, [activeRun?.id]);

  const { currentUserId } = state;
  const isHotSeat = activeRun?.player_id === currentUserId;
  const askRoomUsesRemaining = ladderAskRoomUsesRemaining(room.settings);
  const lockedInScore =
    activeRun && activeRun.current_rung > 0
      ? CHADO_PAURI_RUNG_POINTS[activeRun.current_rung - 1] ?? 0
      : 0;
  const rungIndex = activeRun?.current_rung ?? 0;

  const playerName = (userId: string) =>
    state.scoreboard.find((e) => e.userId === userId)?.displayName ?? "Player";

  const romanisedForOption = useCallback(
    (optionText: string) =>
      resolveOptionRomanised(
        question?.question_payload ?? {
          flashcard_id: "",
          prompt: "",
          correct_answer: "",
          options: [],
          category: null,
          topic_tags: [],
        },
        optionText,
        optionRomanisedByBackText
      ),
    [question?.question_payload, optionRomanisedByBackText]
  );

  const handleVotesChange = useCallback(() => {}, []);

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
    } else if (activeRunIdRef.current === run.id && run.status === "completed") {
      setActiveRun(null);
      setQuestion(null);
    }
  }, []);

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
    onVotesChange: handleVotesChange,
    onParticipantsChange: refreshScoreboard,
  });

  const visibleOptions = useMemo(() => {
    if (!question) return [];
    const eliminated = new Set(question.eliminated_options ?? []);
    return question.question_payload.options.filter((opt) => !eliminated.has(opt));
  }, [question]);

  const displayOptions = isHotSeat ? visibleOptions : question?.question_payload.options ?? [];

  const handleAnswer = (answer: string) => {
    if (!question || !isHotSeat || pending || feedback) return;
    setError(null);
    startTransition(async () => {
      const result = await submitLadderAnswerAction(question.id, answer);
      if (result.error) setError(result.error);
    });
  };

  const handleLifeline = (id: "half_half" | "ask_tutor" | "ask_room") => {
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

  const lifelines = useMemo(
    () =>
      [
        { id: "half_half" as const, label: LIFELINE_LABELS.half_half },
        { id: "ask_tutor" as const, label: LIFELINE_LABELS.ask_tutor },
        {
          id: "ask_room" as const,
          label:
            askRoomUsesRemaining > 0
              ? `Ask the Room (${askRoomUsesRemaining} left)`
              : "Ask the Room (none left)",
        },
      ] as const,
    [askRoomUsesRemaining]
  );

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
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">
          Chado Pauri — Group
        </p>
        <h1 className="text-base font-bold leading-snug text-zinc-900">
          {activeRun
            ? `${playerName(activeRun.player_id)} is in the hot seat`
            : "Waiting for the next player…"}
          {isHotSeat ? " (you)" : ""}
        </h1>
      </div>

      <ChadoPauriGroupPlayerChips
        runs={runs}
        entries={state.scoreboard}
        currentUserId={currentUserId}
      />

      {activeRun && question ? (
        <>
          <ChadoPauriLadder
            variant="compact"
            currentRungIndex={rungIndex}
            lockedInScore={lockedInScore}
          />

          {isHotSeat ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {lifelines.map((lifeline) => {
                  const used =
                    lifeline.id === "half_half"
                      ? activeRun.half_half_used
                      : lifeline.id === "ask_tutor"
                        ? activeRun.ask_tutor_used
                        : activeRun.ask_room_used;
                  const poolExhausted =
                    lifeline.id === "ask_room" && askRoomUsesRemaining <= 0;
                  return (
                    <button
                      key={lifeline.id}
                      type="button"
                      disabled={
                        used ||
                        poolExhausted ||
                        pending ||
                        Boolean(feedback) ||
                        Boolean(question.room_vote_tally && lifeline.id === "ask_room")
                      }
                      onClick={() => handleLifeline(lifeline.id)}
                      className={`${ui.btnSecondary} min-w-[6.5rem] flex-1 px-2 py-2 text-xs disabled:opacity-40`}
                    >
                      {lifeline.label}
                    </button>
                  );
                })}
              </div>
              {activeRun.tutor_hint ? (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  <span className="font-semibold">Tutor hint: </span>
                  {activeRun.tutor_hint}
                </p>
              ) : null}
            </div>
          ) : null}

          {question.room_vote_tally ? (
            <AskRoomAudienceChart
              options={question.question_payload.options}
              tally={question.room_vote_tally}
              romanisedForOption={romanisedForOption}
            />
          ) : null}

          <section className={`${ui.card} space-y-3`}>
            <div className="text-center">
              <p className="text-lg font-bold leading-snug text-zinc-900 sm:text-xl">
                {question.question_payload.prompt}
              </p>
            </div>

            {isHotSeat && !feedback ? (
              <div className="grid gap-2">
                {visibleOptions.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    disabled={pending}
                    onClick={() => handleAnswer(option)}
                    className={`${ui.cardBordered} px-4 py-3 text-center enabled:hover:border-violet-300 enabled:hover:bg-violet-50 sm:py-3.5`}
                  >
                    <ChadoPauriGroupOptionLabel
                      gurmukhi={option}
                      romanised={romanisedForOption(option)}
                      label={OPTION_LABELS[index] ?? String(index + 1)}
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {!isHotSeat && !feedback ? (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {displayOptions.map((option, index) => (
                    <div
                      key={option}
                      className={`${ui.cardBordered} px-4 py-3 text-center opacity-95`}
                      aria-disabled
                    >
                      <ChadoPauriGroupOptionLabel
                        gurmukhi={option}
                        romanised={romanisedForOption(option)}
                        label={OPTION_LABELS[index] ?? String(index + 1)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-zinc-500">
                  Spectating — waiting for {playerName(activeRun.player_id)} to answer…
                </p>
              </div>
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
