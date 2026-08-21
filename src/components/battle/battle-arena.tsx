"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { abandonBattleSession } from "@/app/dashboard/battle/actions";
import { BattleDamageReveal } from "@/components/battle/battle-damage-reveal";
import { BattleGetReady } from "@/components/battle/battle-get-ready";
import { BattleQuestionPanel } from "@/components/battle/battle-question-panel";
import {
  BattleVersusHud,
  type PlayerConnectionStatus,
} from "@/components/battle/battle-versus-hud";
import {
  BATTLE_DISCONNECT_MS,
  BATTLE_QUICK_MATCH_WAIT_MS,
  BATTLE_RECONNECTING_MS,
  BATTLE_ROUND_TIMEOUT_MS,
} from "@/lib/battle/constants";
import type { BattlePlayerProfile } from "@/lib/battle/load-battle";
import { botResponseDelayMs } from "@/lib/battle/bot-opponent";
import { getDisplayName } from "@/lib/profile/display-name";
import { roundMultiplier } from "@/lib/battle/scoring";
import type { BattleQuestionPayload, BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";
import { useBattleRealtime } from "@/hooks/use-battle-realtime";
import { createClient } from "@/lib/supabase/client";
import { CopyButton } from "@/components/ui/copy-button";
import { BackLink } from "@/components/navigation/back-link";
import { ui } from "@/lib/ui/styles";

const OPPONENT_JOINED_MS = 1800;

type BattleArenaProps = {
  initialSession: BattleSessionRow;
  initialRound: BattleRoundRow | null;
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile | null;
  currentUserId: string;
  inviteCode: string;
};

type Phase =
  | "waiting"
  | "opponent_joined"
  | "get_ready"
  | "waiting_for_opponent"
  | "playing"
  | "result"
  | "hp_animating"
  | "finished"
  | "abandoned";

function sessionHasOpponent(session: BattleSessionRow): boolean {
  return Boolean(session.player_two_id || session.is_bot_opponent);
}

function resolveInitialPhase(
  session: BattleSessionRow,
  round: BattleRoundRow | null,
  currentUserId: string
): Phase {
  if (session.status === "waiting") return "waiting";
  if (session.status === "completed") return "finished";
  if (session.status === "abandoned") return "abandoned";

  if (session.status === "active") {
    if (round?.resolved_at) return "result";
    if (round?.round_active_at) return "playing";
    if (round) return "get_ready";
    if (
      session.current_round === 1 &&
      session.player_two_id === currentUserId
    ) {
      return "opponent_joined";
    }
    if (session.current_round === 1 && session.is_bot_opponent && session.player_one_id === currentUserId) {
      return "opponent_joined";
    }
    return "get_ready";
  }

  return "playing";
}

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
  const [phase, setPhase] = useState<Phase>(() =>
    resolveInitialPhase(initialSession, initialRound, currentUserId)
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [getReadyVisualDone, setGetReadyVisualDone] = useState(false);
  const [opponentConnection, setOpponentConnection] =
    useState<PlayerConnectionStatus>("unknown");
  const [opponentDisconnectBanner, setOpponentDisconnectBanner] = useState<string | null>(
    null
  );
  const [quickMatchSecondsLeft, setQuickMatchSecondsLeft] = useState(
    Math.ceil(BATTLE_QUICK_MATCH_WAIT_MS / 1000)
  );
  const quickMatchBotRequestedRef = useRef(false);

  const [preRoundHp, setPreRoundHp] = useState<{ p1: number; p2: number } | null>(null);
  const [displayHp, setDisplayHp] = useState<{ p1: number; p2: number } | null>(null);
  const [damageFlashSide, setDamageFlashSide] = useState<
    "player_one" | "player_two" | null
  >(null);
  const [floatingDamage, setFloatingDamage] = useState<{
    side: "player_one" | "player_two";
    amount: number;
  } | null>(null);

  const opponentLastSeenRef = useRef(Date.now());
  const opponentEverPresentRef = useRef(false);
  const hasMarkedReadyRef = useRef<number | null>(null);
  const isRejoinRef = useRef(
    initialSession.status === "active" &&
      (initialSession.current_round > 1 || Boolean(initialRound))
  );

  const youArePlayerOne = session.player_one_id === currentUserId;
  const opponent = youArePlayerOne ? resolvedPlayerTwo : playerOne;
  const playerTwoProfile = resolvedPlayerTwo ?? {
    id: session.player_two_id ?? (session.is_bot_opponent ? "bot" : ""),
    displayName: session.is_bot_opponent ? "Computer" : "Opponent",
    avatarUrl: null,
  };
  const hasOpponent = sessionHasOpponent(session);

  const markOpponentActive = useCallback(() => {
    opponentLastSeenRef.current = Date.now();
    setOpponentConnection("connected");
    setOpponentDisconnectBanner(null);
  }, []);

  const activateBattle = useCallback((next: BattleSessionRow) => {
    setSession(next);
    setPhase((current) => {
      if (next.status === "completed") return "finished";
      if (next.status === "abandoned") return "abandoned";
      if (
        next.status === "active" &&
        (current === "waiting" || current === "opponent_joined")
      ) {
        return isRejoinRef.current ? "get_ready" : "opponent_joined";
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
      setSession(next);
      if (next.status === "active" && sessionHasOpponent(next)) {
        activateBattle(next);
      }
    },
    [activateBattle]
  );

  const beginNextRound = useCallback(() => {
    setGetReadyVisualDone(false);
    hasMarkedReadyRef.current = null;
    setPreRoundHp(null);
    setDisplayHp(null);
    setDamageFlashSide(null);
    setFloatingDamage(null);
    setSubmitted(false);
    setPhase("get_ready");
  }, []);

  const handleRoundChange = useCallback(
    (next: BattleRoundRow) => {
      if (phase === "result" && round && next.round_number !== round.round_number) {
        return;
      }
      if (phase === "hp_animating" && round && next.round_number !== round.round_number) {
        return;
      }

      setRound(next);

      const opponentAnswered = youArePlayerOne
        ? next.player_two_answered_at
        : next.player_one_answered_at;
      if (opponentAnswered) {
        markOpponentActive();
      }

      if (next.resolved_at && !round?.resolved_at) {
        const damageToP1 = next.player_two_damage_dealt ?? 0;
        const damageToP2 = next.player_one_damage_dealt ?? 0;
        setPreRoundHp({
          p1: session.player_one_hp + damageToP1,
          p2: session.player_two_hp + damageToP2,
        });
        setDisplayHp({
          p1: session.player_one_hp + damageToP1,
          p2: session.player_two_hp + damageToP2,
        });
        setPhase("result");
        return;
      }

      if (next.round_active_at && !next.resolved_at) {
        setSubmitted(false);
        if (phase === "get_ready" || phase === "waiting_for_opponent") {
          setPhase("playing");
        }
      }
    },
    [phase, round, session, youArePlayerOne, markOpponentActive]
  );

  const question = round?.question_payload as BattleQuestionPayload | undefined;
  const multiplier = roundMultiplier(session.current_round);

  useBattleRealtime({
    sessionId: session.id,
    onSessionChange: handleSessionChange,
    onRoundChange: handleRoundChange,
  });

  useEffect(() => {
    if (phase !== "waiting") return;

    const startedAt = Date.now();
    const supabase = createClient();

    const poll = async () => {
      const { data } = await supabase
        .from("battle_sessions")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();

      if (data?.status === "active" && sessionHasOpponent(data as BattleSessionRow)) {
        handleSessionChange(data as BattleSessionRow);
      }
    };

    const tryPairBot = async () => {
      if (quickMatchBotRequestedRef.current || !session.is_quick_match) return;
      quickMatchBotRequestedRef.current = true;

      const res = await fetch("/api/battle/pair-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      });
      const data = await res.json();
      if (data.session) {
        handleSessionChange(data.session as BattleSessionRow);
      }
    };

    void poll();
    const pollId = window.setInterval(() => void poll(), 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const countdownId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((BATTLE_QUICK_MATCH_WAIT_MS - elapsed) / 1000));
      setQuickMatchSecondsLeft(remaining);

      if (elapsed >= BATTLE_QUICK_MATCH_WAIT_MS) {
        void tryPairBot();
      }
    }, 250);

    return () => {
      window.clearInterval(pollId);
      window.clearInterval(countdownId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, session.id, session.is_quick_match, handleSessionChange]);

  useEffect(() => {
    if (phase !== "opponent_joined" || !hasOpponent) return;

    if (session.is_bot_opponent && playerTwo) {
      setResolvedPlayerTwo(playerTwo);
    } else if (!session.player_two_id) {
      return;
    } else {
      const supabase = createClient();
      const opponentId = session.player_two_id!;

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

        await fetch("/api/battle/ensure-round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: session.id }),
        });
      })();
    }

    if (session.is_bot_opponent) {
      void fetch("/api/battle/ensure-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      });
    }

    const timer = window.setTimeout(() => {
      markOpponentActive();
      setGetReadyVisualDone(false);
      setPhase("get_ready");
    }, session.is_bot_opponent ? 900 : OPPONENT_JOINED_MS);

    return () => window.clearTimeout(timer);
  }, [phase, session.id, session.player_two_id, session.is_bot_opponent, hasOpponent, playerTwo, markOpponentActive]);

  useEffect(() => {
    if (session.is_bot_opponent) return;
    if (!session.player_two_id || session.status !== "active") return;

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
          opponentEverPresentRef.current = true;
          markOpponentActive();
        } else if (opponentEverPresentRef.current) {
          setOpponentConnection("reconnecting");
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
            rejoin: isRejoinRef.current,
          });
          markOpponentActive();
        }
      });

    const watchdog = window.setInterval(() => {
      if (!opponentEverPresentRef.current) return;
      const elapsed = Date.now() - opponentLastSeenRef.current;

      if (elapsed > BATTLE_DISCONNECT_MS) {
        setOpponentConnection("disconnected");
        setOpponentDisconnectBanner(
          `${opponent?.displayName ?? "Opponent"} disconnected`
        );
        void abandonBattleSession(session.id);
        return;
      }

      if (elapsed > BATTLE_RECONNECTING_MS) {
        setOpponentConnection("reconnecting");
        setOpponentDisconnectBanner(
          `${opponent?.displayName ?? "Opponent"} reconnecting…`
        );
      }
    }, 3000);

    return () => {
      window.clearInterval(watchdog);
      void supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    session.id,
    session.status,
    session.player_two_id,
    session.player_one_id,
    youArePlayerOne,
    opponent?.displayName,
    markOpponentActive,
  ]);

  useEffect(() => {
    if (phase !== "get_ready" && phase !== "waiting_for_opponent") return;
    if (!getReadyVisualDone) return;
    if (!hasOpponent) return;

    const roundNumber = session.current_round;
    if (hasMarkedReadyRef.current === roundNumber) return;

    hasMarkedReadyRef.current = roundNumber;

    void (async () => {
      const ensureRes = await fetch("/api/battle/ensure-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      });
      const ensureData = await ensureRes.json();
      if (ensureData.round) setRound(ensureData.round);

      const readyRes = await fetch("/api/battle/mark-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          round_number: roundNumber,
        }),
      });
      const readyData = await readyRes.json();

      if (readyData.round) {
        setRound(readyData.round);
        if (readyData.round.round_active_at) {
          setPhase("playing");
          return;
        }
      }

      setPhase("waiting_for_opponent");
    })();
  }, [phase, getReadyVisualDone, session.id, session.current_round, hasOpponent]);

  useEffect(() => {
    if (!session.is_bot_opponent || phase !== "playing" || !round?.round_active_at || round.resolved_at) {
      return;
    }
    if (round.player_two_answered_at) return;

    const skill = session.bot_skill ?? 0.55;
    const delay = botResponseDelayMs(skill);
    const timer = window.setTimeout(() => {
      void fetch("/api/battle/bot-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          round_number: round.round_number,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.round) setRound(data.round);
          if (data.resolved) {
            if (data.session) setSession(data.session);
            if (data.round) {
              setPreRoundHp({
                p1:
                  (data.session?.player_one_hp ?? session.player_one_hp) +
                  (data.round.player_two_damage_dealt ?? 0),
                p2:
                  (data.session?.player_two_hp ?? session.player_two_hp) +
                  (data.round.player_one_damage_dealt ?? 0),
              });
              setDisplayHp({
                p1:
                  (data.session?.player_one_hp ?? session.player_one_hp) +
                  (data.round.player_two_damage_dealt ?? 0),
                p2:
                  (data.session?.player_two_hp ?? session.player_two_hp) +
                  (data.round.player_one_damage_dealt ?? 0),
              });
              setRound(data.round);
            }
            setPhase("result");
          }
        })
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    phase,
    round,
    session.id,
    session.is_bot_opponent,
    session.player_one_hp,
    session.player_two_hp,
  ]);

  useEffect(() => {
    if (phase !== "playing" || !round?.round_active_at || round.resolved_at) return;

    const tick = () => {
      const elapsed = Date.now() - new Date(round.round_active_at!).getTime();
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
              if (data.round) {
                setPreRoundHp({
                  p1:
                    (data.session?.player_one_hp ?? session.player_one_hp) +
                    (data.round.player_two_damage_dealt ?? 0),
                  p2:
                    (data.session?.player_two_hp ?? session.player_two_hp) +
                    (data.round.player_one_damage_dealt ?? 0),
                });
                setDisplayHp({
                  p1:
                    (data.session?.player_one_hp ?? session.player_one_hp) +
                    (data.round.player_two_damage_dealt ?? 0),
                  p2:
                    (data.session?.player_two_hp ?? session.player_two_hp) +
                    (data.round.player_one_damage_dealt ?? 0),
                });
                setRound(data.round);
              }
              setPhase("result");
            }
          })
          .catch(() => undefined);
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [session.id, session.player_one_hp, session.player_two_hp, phase, round]);

  const submitAnswer = async (answer: string) => {
    if (!round || submitted || phase !== "playing" || !round.round_active_at) return;

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
        const message = data.error ?? "Could not submit answer.";
        if (message.toLowerCase().includes("not active")) {
          setPhase("waiting_for_opponent");
        }
        setError(message);
        setSubmitted(false);
        return;
      }
      if (data.resolved) {
        if (data.session) setSession(data.session);
        if (data.round) {
          setPreRoundHp({
            p1:
              (data.session?.player_one_hp ?? session.player_one_hp) +
              (data.round.player_two_damage_dealt ?? 0),
            p2:
              (data.session?.player_two_hp ?? session.player_two_hp) +
              (data.round.player_one_damage_dealt ?? 0),
          });
          setDisplayHp({
            p1:
              (data.session?.player_one_hp ?? session.player_one_hp) +
              (data.round.player_two_damage_dealt ?? 0),
            p2:
              (data.session?.player_two_hp ?? session.player_two_hp) +
              (data.round.player_one_damage_dealt ?? 0),
          });
          setRound(data.round);
        }
        setPhase("result");
      }
    } catch {
      setError("Could not submit answer.");
      setSubmitted(false);
    }
  };

  const handleDamageRevealComplete = useCallback(
    (result: {
      displayPlayerOneHp: number;
      displayPlayerTwoHp: number;
      damageRecipient: "player_one" | "player_two" | null;
      finalDamage: number;
    }) => {
      if (result.finalDamage > 0 && result.damageRecipient) {
        setFloatingDamage({
          side: result.damageRecipient,
          amount: result.finalDamage,
        });
        setDamageFlashSide(result.damageRecipient);
      }
      setDisplayHp({ p1: result.displayPlayerOneHp, p2: result.displayPlayerTwoHp });
      setPhase("hp_animating");

      window.setTimeout(() => {
        setSession((current) => {
          const updated = {
            ...current,
            player_one_hp: result.displayPlayerOneHp,
            player_two_hp: result.displayPlayerTwoHp,
          };

          if (result.displayPlayerOneHp <= 0 || result.displayPlayerTwoHp <= 0) {
            setPhase("finished");
            return updated;
          }

          beginNextRound();
          return updated;
        });
        setFloatingDamage(null);
        setDamageFlashSide(null);
        setPreRoundHp(null);
        setDisplayHp(null);
      }, 1000);
    },
    [beginNextRound]
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/dashboard/battle?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  const selfConnection: PlayerConnectionStatus = "connected";
  const p1Connection = youArePlayerOne ? selfConnection : opponentConnection;
  const p2Connection = youArePlayerOne ? opponentConnection : selfConnection;

  const hudPlayerOneHp = displayHp?.p1 ?? session.player_one_hp;
  const hudPlayerTwoHp = displayHp?.p2 ?? session.player_two_hp;

  if (phase === "waiting") {
    if (session.is_quick_match) {
      return (
        <div className={ui.page}>
          <h1 className="text-2xl font-bold text-zinc-900">Finding an opponent</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Looking for someone else in quick match. If no one joins in {quickMatchSecondsLeft}s,
            you&apos;ll face the computer instead.
          </p>
          <div className={`mt-6 ${ui.card} text-center`}>
            <p className="text-4xl" aria-hidden="true">
              ⚡
            </p>
            <p className="mt-4 text-sm font-medium text-zinc-700">Searching for a live opponent…</p>
            <p className="mt-2 font-mono text-3xl font-bold text-violet-600">{quickMatchSecondsLeft}s</p>
          </div>
          <Link href="/dashboard/battle" className={`mt-6 inline-block ${ui.btnGhost}`}>
            ← Cancel
          </Link>
        </div>
      );
    }

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
              <CopyButton text={inviteCode}>Copy code</CopyButton>
              <CopyButton text={shareUrl} className="ml-2">
                Copy invite link
              </CopyButton>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-center text-sm text-zinc-400">Waiting for someone to join…</p>
        <BackLink fallbackHref="/dashboard/learn" className={`mt-6 inline-block ${ui.btnGhost}`}>
          ← Back
        </BackLink>
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
            {opponentDisconnectBanner ??
              "Your opponent disconnected. You can head back to the dashboard."}
          </p>
          <Link href="/dashboard/battle" className={`mt-6 ${ui.btnPrimary}`}>
            Back to battle lobby
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
          <BackLink fallbackHref="/dashboard/learn" className={`mt-3 block ${ui.btnGhost}`}>
            ← Back
          </BackLink>
        </div>
      </div>
    );
  }

  if ((phase === "get_ready" || phase === "waiting_for_opponent") && hasOpponent) {
    return (
      <div className={ui.page}>
        <BattleGetReady
          roundNumber={session.current_round}
          multiplier={multiplier}
          waitingForOpponent={phase === "waiting_for_opponent"}
          opponentName={opponent?.displayName}
          onComplete={() => setGetReadyVisualDone(true)}
        />
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Live battle
        </p>
        <h1 className="text-xl font-bold text-zinc-900">Round {session.current_round}</h1>
      </div>

      {opponentDisconnectBanner ? (
        <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {opponentDisconnectBanner}
        </p>
      ) : null}

      {hasOpponent ? (
        <BattleVersusHud
          playerOne={playerOne}
          playerTwo={playerTwoProfile}
          playerOneHp={session.player_one_hp}
          playerTwoHp={session.player_two_hp}
          displayPlayerOneHp={hudPlayerOneHp}
          displayPlayerTwoHp={hudPlayerTwoHp}
          multiplier={multiplier}
          youArePlayerOne={youArePlayerOne}
          playerOneConnection={p1Connection}
          playerTwoConnection={p2Connection}
          damageFlashSide={damageFlashSide}
          floatingDamage={floatingDamage}
        />
      ) : null}

      {phase === "playing" && round?.round_active_at ? (
        <div className="mt-4 flex items-center justify-center">
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              secondsLeft <= 5 ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {secondsLeft}s
          </span>
        </div>
      ) : null}

      {(phase === "result" || phase === "hp_animating") && round && preRoundHp ? (
        <div className="mt-6">
          {phase === "result" ? (
            <BattleDamageReveal
              round={round}
              playerOne={playerOne}
              playerTwo={playerTwoProfile}
              preRoundPlayerOneHp={preRoundHp.p1}
              preRoundPlayerTwoHp={preRoundHp.p2}
              onComplete={handleDamageRevealComplete}
            />
          ) : null}
        </div>
      ) : null}

      {phase === "playing" && !round?.round_active_at ? (
        <p className="mt-8 text-center text-sm text-zinc-500">
          {phase === "playing" && !round
            ? "Loading round…"
            : `Waiting for ${opponent?.displayName ?? "opponent"}…`}
        </p>
      ) : null}

      {phase === "playing" && question && round?.round_active_at ? (
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
