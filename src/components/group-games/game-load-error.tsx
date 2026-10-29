"use client";

import { endGameRoom, leaveGameRoom } from "@/app/dashboard/group-games/actions";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type GameLoadErrorProps = {
  roomId: string;
  isHost: boolean;
  gameLabel: string;
  message: string;
};

/**
 * Shown instead of crashing when a group game can't load. Gives everyone a way out,
 * so a refresh never drops them back into the same broken screen.
 */
export function GameLoadError({ roomId, isHost, gameLabel, message }: GameLoadErrorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function leave(end: boolean) {
    setError(null);
    startTransition(async () => {
      const result = end ? await endGameRoom(roomId) : await leaveGameRoom(roomId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard/community");
    });
  }

  return (
    <div className={`${ui.card} space-y-4 text-center`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{gameLabel}</p>
      <h1 className="text-2xl font-bold text-zinc-900">This game couldn&apos;t load</h1>
      <p className="text-sm text-zinc-600">{message}</p>
      {isHost ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => leave(true)}
          className={`${ui.btnPrimaryBlock} disabled:opacity-60`}
        >
          {pending ? "Ending…" : "End this game for everyone"}
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => leave(false)}
        className={`${ui.btnSecondary} w-full justify-center disabled:opacity-60`}
      >
        Back to Community
      </button>
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
