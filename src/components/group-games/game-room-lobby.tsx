"use client";

import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  leaveGameRoom,
  setHostPlaying,
  startGameRoom,
} from "@/app/dashboard/group-games/actions";
import { useGameRoomRealtime } from "@/hooks/use-game-room-realtime";
import { GROUP_GAME_LABELS } from "@/lib/game-rooms/constants";
import { loadActiveParticipants } from "@/lib/game-rooms/load-room";
import type { GameRoomParticipantView, GameRoomRow, GameRoomView } from "@/lib/game-rooms/types";
import { getDisplayName } from "@/lib/profile/display-name";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type GameRoomLobbyProps = {
  initialView: GameRoomView;
};

async function fetchParticipantViews(
  roomId: string,
  currentUserId: string
): Promise<GameRoomParticipantView[]> {
  const supabase = createClient();
  const rows = await loadActiveParticipants(supabase, roomId);
  const userIds = rows.map((r) => r.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        displayName: getDisplayName(p) ?? "Player",
        avatarUrl: p.avatar_url ?? null,
      },
    ])
  );

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      displayName: profile?.displayName ?? "Player",
      avatarUrl: profile?.avatarUrl ?? null,
      isHost: row.is_host,
      isPlaying: row.is_playing,
    };
  });
}

export function GameRoomLobby({ initialView }: GameRoomLobbyProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialView.room);
  const [participants, setParticipants] = useState(initialView.participants);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { isHost, currentUserId } = initialView;
  const selfParticipant = participants.find((p) => p.userId === currentUserId);
  const hostIsPlaying = selfParticipant?.isPlaying ?? false;
  const playingCount = participants.filter((p) => p.isPlaying).length;
  const canStart = playingCount >= 1;

  const refreshParticipants = useCallback(async () => {
    const next = await fetchParticipantViews(room.id, currentUserId);
    setParticipants(next);
  }, [room.id, currentUserId]);

  const handleRoomChange = useCallback(
    (next: GameRoomRow) => {
      setRoom(next);
      if (next.status === "in_progress") {
        router.push(`/dashboard/group-games/room/${next.id}/play`);
        return;
      }
      if (next.status === "cancelled") {
        router.push("/dashboard/group-games?cancelled=1");
      }
    },
    [router]
  );

  useGameRoomRealtime({
    roomId: room.id,
    onRoomChange: handleRoomChange,
    onParticipantsChange: refreshParticipants,
  });

  useEffect(() => {
    if (room.status === "in_progress") {
      router.push(`/dashboard/group-games/room/${room.id}/play`);
    }
  }, [room.status, room.id, router]);

  const handleTogglePlaying = () => {
    setError(null);
    startTransition(async () => {
      const result = await setHostPlaying(room.id, !hostIsPlaying);
      if (result.error) {
        setError(result.error);
        return;
      }
      await refreshParticipants();
    });
  };

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await startGameRoom(room.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/group-games/room/${room.id}/play`);
    });
  };

  const handleLeave = () => {
    setError(null);
    startTransition(async () => {
      const result = await leaveGameRoom(room.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard/group-games");
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <BackLink fallbackHref="/dashboard/group-games" className="text-sm font-medium text-violet-600 hover:text-violet-700">← Back to group games</BackLink>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">
          {GROUP_GAME_LABELS[room.game_type]}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Waiting in the lobby for everyone to join.</p>
      </div>

      {isHost ? (
        <section className={`${ui.card} text-center`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Share this code</p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-zinc-900">
            {room.join_code}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Students enter this code on Group games → Join a game
          </p>
        </section>
      ) : null}

      <section className={`${ui.card} space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-zinc-900">
            In the room ({participants.length})
          </h2>
          <span className="text-xs font-medium text-zinc-500">
            {playingCount} playing
          </span>
        </div>

        <ul className="divide-y divide-zinc-100">
          {participants.map((participant) => (
            <li key={participant.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700"
                aria-hidden="true"
              >
                {participant.displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-900">
                  {participant.displayName}
                  {participant.userId === currentUserId ? " (you)" : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {participant.isHost ? "Host" : "Player"}
                  {participant.isHost && !participant.isPlaying ? " · facilitating" : ""}
                  {!participant.isHost && participant.isPlaying ? " · playing" : ""}
                  {!participant.isHost && !participant.isPlaying ? " · spectating" : ""}
                  {participant.isHost && participant.isPlaying ? " · playing" : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  participant.isPlaying
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {participant.isPlaying ? "Playing" : "Not playing"}
              </span>
            </li>
          ))}
        </ul>

        {participants.length === 0 ? (
          <p className="text-sm text-zinc-500">No one in the room yet.</p>
        ) : null}
      </section>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {isHost ? (
        <section className={`${ui.card} space-y-4`}>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-900">I&apos;m playing too</p>
              <p className="text-sm text-zinc-500">
                Off by default — useful when you&apos;re facilitating rather than competing.
              </p>
            </div>
            <input
              type="checkbox"
              checked={hostIsPlaying}
              onChange={handleTogglePlaying}
              disabled={pending}
              className="h-5 w-5 accent-violet-600"
            />
          </label>

          <button
            type="button"
            onClick={handleStart}
            disabled={pending || !canStart}
            className={ui.btnPrimaryBlock}
          >
            {pending ? "Starting…" : "Start game"}
          </button>

          {!canStart ? (
            <p className="text-center text-sm text-zinc-500">
              Need at least one player marked as playing before you can start.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="text-center text-sm text-zinc-500">
          Waiting for the host to start the game…
        </p>
      )}

      <button
        type="button"
        onClick={handleLeave}
        disabled={pending}
        className={`${ui.btnSecondary} w-full justify-center text-rose-600 hover:text-rose-700`}
      >
        Leave room
      </button>
    </div>
  );
}
