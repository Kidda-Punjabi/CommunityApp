"use client";

import {
  approveLate,
  approveRooms,
  movePerson,
  setFlashcardActivityType,
  skipActivity,
  suggestRooms,
} from "@/app/admin/community/breakout-actions";
import { FLASHCARD_CARD_TYPES, FLASHCARD_CARD_TYPE_LABELS, type FlashcardCardType } from "@/lib/flashcards/types";
import { RoomRefresh } from "@/components/community/room-refresh";
import { bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import type { CommunityBand } from "@/lib/community/constants";
import { ui } from "@/lib/ui/styles";
import { useState } from "react";

export type HostRoomCard = {
  id: string;
  roomNumber: number;
  band: CommunityBand;
  status: string;
  progress: string | null;
  flashcards: { id: string; position: number; status: string; cardType: FlashcardCardType }[];
  members: { userId: string; name: string; level: number; pending: boolean }[];
};

export function BreakoutHostView({
  occurrenceId,
  rooms,
}: {
  occurrenceId: string;
  rooms: HostRoomCard[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const roomNumbers = rooms.map((room) => room.roomNumber);
  const openCount = rooms.filter((room) => room.status !== "closed").length;
  const canApprove = rooms.some((room) => room.status === "suggested");

  async function run(action: () => Promise<{ error?: string } | { ok: true } | { error: string } | { ok: true; rooms: number }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <section className={ui.card}>
      <RoomRefresh channelId={occurrenceId} />
      <h2 className="font-heading text-lg font-semibold">Breakout rooms</h2>
      <p className="mt-1 text-sm font-semibold text-zinc-800">Create {openCount} breakout rooms in Meet</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={ui.btnSecondary} onClick={() => run(() => suggestRooms(occurrenceId))}>
          Suggest rooms
        </button>
        <button type="button" disabled={pending || !canApprove} className={ui.btnPrimary} onClick={() => run(() => approveRooms(occurrenceId))}>
          Approve rooms
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="mt-4 space-y-4">
        {rooms.map((room) => (
          <div key={room.id} className="rounded-2xl border border-zinc-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-zinc-900">
                Room {room.roomNumber} · {bandLabel(room.band)}
              </p>
              <span className="text-xs uppercase tracking-wide text-zinc-500">{room.status}</span>
            </div>
            {room.progress ? <p className="mt-1 text-sm text-zinc-600">{room.progress}</p> : null}
            {room.status === "approved" ? (
              <button type="button" disabled={pending} className="mt-2 text-sm font-semibold text-violet-700" onClick={() => run(() => skipActivity(room.id))}>
                Skip to next
              </button>
            ) : null}
            {room.flashcards
              .filter((item) => item.status !== "done")
              .map((item) => (
                <label key={item.id} className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
                  Activity {item.position + 1} flashcards
                  <select
                    className="h-10 rounded-xl border border-zinc-200 px-2 text-sm"
                    value={item.cardType}
                    disabled={pending}
                    onChange={(event) => void run(() => setFlashcardActivityType(item.id, event.target.value))}
                  >
                    {FLASHCARD_CARD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FLASHCARD_CARD_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            <ul className="mt-3 space-y-2">
              {room.members.map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{member.name}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: levelFillVar(member.level), color: levelInkVar(member.level) }}>
                    Level {member.level}
                  </span>
                  {member.pending ? (
                    <button type="button" disabled={pending} className="text-sm font-semibold text-violet-700" onClick={() => run(() => approveLate(occurrenceId, member.userId))}>
                      Approve
                    </button>
                  ) : null}
                  <label className="ml-auto text-xs text-zinc-500">
                    Move to
                    <select
                      className="ml-2 h-10 rounded-xl border border-zinc-200 px-2 text-sm"
                      defaultValue=""
                      disabled={pending}
                      onChange={(event) => {
                        const target = event.target.value;
                        if (!target) return;
                        void run(() => movePerson(occurrenceId, member.userId, target));
                        event.target.value = "";
                      }}
                    >
                      <option value="">Choose</option>
                      {roomNumbers
                        .filter((number) => number !== room.roomNumber)
                        .map((number) => (
                          <option key={number} value={String(number)}>
                            Room {number}
                          </option>
                        ))}
                      <option value="new">New room</option>
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
