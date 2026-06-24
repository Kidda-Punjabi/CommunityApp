"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { abandonBattleSession } from "@/app/dashboard/battle/actions";
import { BattleHpBar } from "@/components/battle/battle-hp-bar";
import { BattleQuestionPanel } from "@/components/battle/battle-question-panel";
import { BattleRoundResult } from "@/components/battle/battle-round-result";
import {
  BATTLE_DISCONNECT_MS,
  BATTLE_ROUND_TIMEOUT_MS,
} from "@/lib/battle/constants";
import type { BattlePlayerProfile } from "@/lib/battle/load-battle";
import { getDisplayName } from "@/lib/profile/display-name";
import { roundMultiplier } from "@/lib/battle/scoring";
import type { BattleQuestionPayload, BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";
import { useBattleRealtime } from "@/hooks/use-battle-realtime";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

const ROUND_RESULT_MS = 2800;

type BattleArenaProps = {
  initialSession: BattleSessionRow;
  initialRound: BattleRoundRow | null;
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile | null;
  currentUserId: string;
  inviteCode: string;
};

type Phase = "playing" | "result" | "finished" | "waiting" | "opponent_joined" | "abandoned";

const OPPONENT_JOINED_MS = 1800;

export function BattleArena({
  initialSession,
  initialRound,
  playerOne,
  playerTwo,
  currentUserId,
  inviteCode,
}: BattleArenaProps) {
  const [session, setSession] = useState(initialSession);
  const [round, setRound] = useState<BattleRoundRow | null>(initialRound);
  const [resolvedPlayerTwo, setResolvedPlayerTwo] = useState<BattlePlayerProfile | null>(playerTwo);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialSession.status === "waiting") return "waiting";
    if (initialSession.status === "completed") return "finished";
    if (initialSession.status === "abandoned") return "abandoned";
    if (
      initialSession.status === "active" &&
      initialSession.player_two_id === currentUserId
    ) {
      return "opponent_joined";
    }
    return "playing";
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const opponentLastSeenRef = useRef<number>(Date.now());

  const youArePlayerOne = session.player_one_id === currentUserId;
  const opponent = youArePlayerOne ? resolvedPlayerTwo : playerOne;
  const you = youArePlayerOne ? playerOne : (resolvedPlayerTwo ?? playerOne);

  const activateBattle = useCallback((next: BattleSessionRow) => {
    setSession(next);
    setPhase((current) => {
      if (next.status === "completed") return "finished";
      if (next.status === "abandoned") return "abandoned";
      if (next.status === "active" && (current === "waiting" || current === "opponent_joined")) {
        return "opponent_joined";
      }
      return current;
    });
  }, []);

  const handleSessionChange = useCallback(
    (next: BattleSessionRow) => {
      if (next.status === "completed") {
        setSession(next);
        setPhase("finished");
        return;
      }
      if (next.status === "abandoned") {
        setSession(next);
        setPhase("abandoned");
        return;
      }
      if (next.status === "active" && next.player_two_id) {
        activateBattle(next);
        return;
      }
      setSession(next);
    },
    [activateBattle]
  );

  const handleRoundChange = useCallback((next: BattleRoundRow) => {
    if (phase === "result" && round && next.round_number !== round.round_number) {
      return;
    }
    setRound(next);
    if (next.resolved_at) {
      setPhase("result");
    } else if (next.round_number === session.current_round) {
      setSubmitted(false);
      setPhase("playing");
    }
  }, [phase, round, session.current_round]);

  const question = round?.question_payload as BattleQuestionPayload | undefined;
  const multiplier = roundMultiplier(session.current_round);

  useBattleRealtime({
    sessionId: session.id,
    onSessionChange: handleSessionChange,
    onRoundChange: handleRoundChange,
  });

  useEffect(() => {
    if (phase !== "waiting") return;

    const supabase = createClient();

    const poll = async () => {
      const { data } = await supabase
        .from("battle_sessions")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();

      if (data?.status === "active" && data.player_two_id) {
        handleSessionChange(data as BattleSessionRow);
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(id);
  }, [phase, session.id, handleSessionChange]);

  useEffect(() => {
    if (phase !== "opponent_joined" || !session.player_two_id) return;

    const supabase = createClient();
    const opponentId = session.player_two_id;

    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url")
        .eq("id", opponentId)
        .maybeSingle();

      if (profile) {
        setResolvedPlayerTwo({
          id: profile.id,
          displayName: getDisplayName(profile) ?? "Opponent",
          avatarUrl: profile.avatar_url ?? null,
        });
      } else {
        setResolvedPlayerTwo({
          id: opponentId,
          displayName: "Opponent",
          avatarUrl: null,
        });
      }

      const res = await fetch("/api/battle/ensure-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      });
      const data = await res.json();
      if (data.round) setRound(data.round);
    })();

    const timer = window.setTimeout(() => setPhase("playing"), OPPONENT_JOINED_MS);
    return () => window.clearTimeout(timer);
  }, [phase, session.id, session.player_two_id]);

  useEffect(() => {
    if (session.status !== "active" || !round || round.resolved_at) return;

    const tick = () => {
      const elapsed = Date.now() - new Date(round.round_started_at).getTime();
      const remaining = Math.max(0, Math.ceil((BATTLE_ROUND_TIMEOUT_MS - elapsed) / 1000));
      setSecondsLeft(remaining);

      if (remaining === 0) {
        void fetch("/api/battle/resolve-round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: session.id,
            round_number: round.round_number,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.resolved) {
              if (data.session) setSession(data.session);
              if (data.round) setRound(data.round);
              setPhase("result");
            }
          })
          .catch(() => undefined);
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [session.id, session.status, round]);

  useEffect(() => {
    if (session.status !== "waiting" && session.status !== "active") return;

    const supabase = createClient();
    const channel = supabase.channel(`battle-presence:${session.id}`, {
      config: { presence: { key: currentUserId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const opponentId = youArePlayerOne ? session.player_two_id : session.player_one_id;
        if (!opponentId) return;

        const opponentPresent = Object.values(state).some((presences) =>
          presences.some((p) => (p as { user_id?: string }).user_id === opponentId)
        );

        if (opponentPresent) {
          opponentLastSeenRef.current = Date.now();
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
        }
      });

    const watchdog = window.setInterval(() => {
      if (session.status !== "active" || !session.player_two_id) return;
      if (Date.now() - opponentLastSeenRef.current > BATTLE_DISCONNECT_MS) {
        void abandonBattleSession(session.id);
      }
    }, 5000);

    return () => {
      window.clearInterval(watchdog);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, session, youArePlayerOne]);

  useEffect(() => {
    if (session.status !== "active" || phase !== "playing") return;

    void fetch("/api/battle/ensure-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.round) setRound(data.round);
      })
      .catch(() => undefined);
  }, [session.id, session.status, session.current_round, phase]);

  useEffect(() => {
    if (phase !== "result" || !round?.resolved_at) return;

    const timer = window.setTimeout(() => {
      if (session.status === "completed") {
        setPhase("finished");
        return;
      }
      setSubmitted(false);
      setPhase("playing");
      void fetch("/api/battle/ensure-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.round) setRound(data.round);
        })
        .catch(() => undefined);
    }, ROUND_RESULT_MS);

    return () => window.clearTimeout(timer);
  }, [phase, round?.resolved_at, session.id, session.status]);

  const submitAnswer = async (answer: string) => {
    if (!round || submitted || phase !== "playing") return;

    setSubmitted(true);
    setError(null);

    try {
      const res = await fetch("/api/battle/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
          answer,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not submit answer.");
        setSubmitted(false);
        return;
      }
      if (data.resolved) {
        if (data.session) setSession(data.session);
        if (data.round) setRound(data.round);
        setPhase("result");
      }
    } catch {
      setError("Could not submit answer.");
      setSubmitted(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/dashboard/battle?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  if (phase === "waiting") {
    return (
      <div className={ui.page}>
        <h1 className="text-2xl font-bold text-zinc-900">Waiting for opponent</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Share the code or link below. Your friend opens{" "}
          <span className="font-medium text-zinc-700">Battle a Friend</span> on their dashboard and
          enters the code under &ldquo;Join a battle&rdquo;.
        </p>
        <div className={`mt-6 ${ui.card} text-center`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Battle code</p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-[0.2em] text-violet-600">
            {inviteCode}
          </p>
          {shareUrl ? (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className={ui.btnSecondary}
                onClick={() => void navigator.clipboard.writeText(inviteCode)}
              >
                Copy code
              </button>
              <button
                type="button"
                className={`${ui.btnSecondary} ml-2`}
                onClick={() => void navigator.clipboard.writeText(shareUrl)}
              >
                Copy invite link
              </button>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-center text-sm text-zinc-400">Waiting for someone to join…</p>
        <Link href="/dashboard/home" className={`mt-6 inline-block ${ui.btnGhost}`}>
          Back to home
        </Link>
      </div>
    );
  }

  if (phase === "opponent_joined") {
    const joinedName = youArePlayerOne
      ? (resolvedPlayerTwo?.displayName ?? "Your opponent")
      : playerOne.displayName;

    return (
      <div className={ui.page}>
        <div className={`${ui.card} text-center`}>
          <p className="text-4xl" aria-hidden="true">
            ⚔️
          </p>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">
            {youArePlayerOne ? `${joinedName} has joined!` : "You're in!"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Starting battle…</p>
        </div>
      </div>
    );
  }

  if (phase === "abandoned") {
    return (
      <div className={ui.page}>
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">Battle abandoned</p>
          <p className="mt-2 text-sm text-zinc-500">
            Your opponent disconnected. You can head back to the dashboard.
          </p>
          <Link href="/dashboard/home" className={`mt-6 ${ui.btnPrimary}`}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    const youWon = session.winner_id === currentUserId;
    return (
      <div className={ui.page}>
        <div className={`${ui.card} text-center`}>
          <p className="text-3xl" aria-hidden="true">
            {youWon ? "🏆" : "⚔️"}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">
            {youWon ? "Victory!" : "Defeat"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {youWon
              ? "You reduced your opponent to zero HP."
              : `${opponent?.displayName ?? "Your opponent"} won the battle.`}
          </p>
          <Link href="/dashboard/battle" className={`mt-6 inline-block ${ui.btnPrimary}`}>
            Battle again
          </Link>
          <Link href="/dashboard/home" className={`mt-3 block ${ui.btnGhost}`}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Live battle
          </p>
          <h1 className="text-xl font-bold text-zinc-900">Round {session.current_round}</h1>
        </div>
        <div className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
          ×{multiplier.toFixed(1)}
        </div>
      </div>

      <div className="space-y-3">
        <BattleHpBar
          label={you.displayName}
          hp={youArePlayerOne ? session.player_one_hp : session.player_two_hp}
          highlight
        />
        <BattleHpBar
          label={opponent?.displayName ?? "Opponent"}
          hp={youArePlayerOne ? session.player_two_hp : session.player_one_hp}
          align="right"
        />
      </div>

      <div className="mt-4 flex items-center justify-center">
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            secondsLeft <= 5 ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {secondsLeft}s
        </span>
      </div>

      {phase === "result" && round && resolvedPlayerTwo ? (
        <div className="mt-6">
          <BattleRoundResult
            round={round}
            playerOne={playerOne}
            playerTwo={resolvedPlayerTwo}
            youArePlayerOne={youArePlayerOne}
          />
        </div>
      ) : null}

      {phase === "playing" && !question ? (
        <p className="mt-8 text-center text-sm text-zinc-500">Loading round…</p>
      ) : null}

      {phase === "playing" && question ? (
        <div className="mt-6">
          {submitted ? (
            <p className="text-center text-sm font-medium text-zinc-500">
              Answer locked in — waiting for round to resolve…
            </p>
          ) : null}
          {error ? <p className="mb-3 text-center text-sm text-rose-600">{error}</p> : null}
          <BattleQuestionPanel question={question} disabled={submitted} onAnswer={submitAnswer} />
        </div>
      ) : null}
    </div>
  );
}
